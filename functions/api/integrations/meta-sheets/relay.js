import { assertD1, jsonResponse, optionsResponse } from '../../_shared.js';
import { ensureWebhookSchema, intakeCanonicalLead, sha256 } from '../../calltag/v1/_shared.js';
import { notifyUniversalLeadAvailable } from '../../call/push/_shared.js';

const METHODS = 'POST, OPTIONS';
const FIELD = {
  id: ['id', 'lead_id'], created: ['created_time', 'created_at'],
  name: ['full_name', '이름', '성함'], phone: ['phone_number', '연락처', '전화번호'],
  money: ['총_채무액(2,000만원_이상_가능)', '총_채무액_선택_(2,000미만_불가)', '채무금액'],
  time: ['상담가능시간'], message: ['문의내용(ex개인회생/파산_등)', '문의내용_(ex.개인회생/파산_등)', '문의내용'],
  area: ['거주지역을_입력해주세요', '거주지역'], email: ['email', '이메일']
};
function pick(fields, aliases) {
  for (const k of aliases) if (fields[k] !== undefined) return String(fields[k] ?? '').trim();
  return '';
}
export function normalizePhone(raw) {
  let value = String(raw || '').replace(/\D/g, '');
  if (value.startsWith('0082')) value = value.slice(2);
  if (value.startsWith('82') && value.length >= 10 && value.length <= 13) value = '0' + value.slice(2);
  if (value.startsWith('10') && value.length === 10) value = '0' + value;
  return value;
}
export function isMetaTestLead(row) {
  return !!row && typeof row === 'object' && !Array.isArray(row)
    && Object.values(row).some(v => /<test lead:|dummy data/i.test(String(v ?? '')));
}
export function normalizeSheetLead(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (isMetaTestLead(row)) return null;
  const external = pick(row, FIELD.id).slice(0, 120);
  const phone = normalizePhone(pick(row, FIELD.phone));
  if (!external || !/^[\w:-]+$/.test(external) || !/^01\d{8,9}$/.test(phone)) return null;
  const dt = pick(row, FIELD.created);
  return {
    eventId: 'meta-' + external.replace(/[^a-zA-Z0-9_-]/g, ''),
    name: pick(row, FIELD.name).slice(0, 120),
    phone, email: pick(row, FIELD.email).slice(0, 240),
    money: pick(row, FIELD.money).slice(0, 240),
    calldate: pick(row, FIELD.time).slice(0, 240),
    content: pick(row, FIELD.message).slice(0, 1200),
    area: pick(row, FIELD.area).slice(0, 240),
    submitted: dt && !Number.isNaN(Date.parse(dt)) ? new Date(dt).toISOString() : new Date().toISOString()
  };
}
export function advertiserForm(lead, item = '64') {
  const form = new URLSearchParams({ ITEM: String(item) });
  const phone = /^010\d{8}$/.test(lead.phone)
    ? lead.phone.slice(0,3) + '-' + lead.phone.slice(3,7) + '-' + lead.phone.slice(7)
    : lead.phone;
  const fields = {
    DATAS_name: lead.name, DATAS_phone: phone, DATAS_money: lead.money,
    DATAS_area: lead.area, DATAS_calldate: lead.calldate,
    DATAS_data: lead.content, DATAS_email: lead.email,
    DATAS_insert_ad: 'Meta Lead Ads'
  };
  Object.entries(fields).forEach(([key,value]) => { if (value) form.set(key,value); });
  return form.toString();
}
export function explicitAdvertiserSuccess(status, body) {
  if (status < 200 || status >= 300) return false;
  const raw = String(body || '').trim();
  if (/^(OK|SUCCESS|1)$/i.test(raw)) return true;
  try {
    const json = JSON.parse(raw);
    return json?.ok === true || json?.success === true
      || /^(OK|SUCCESS|ACCEPTED)$/i.test(String(json?.status || json?.result || ''));
  } catch { return false; }
}
async function ensureSchema(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS meta_sheet_dual_queue (event_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, ct_status TEXT NOT NULL DEFAULT 'PENDING', ad_status TEXT NOT NULL DEFAULT 'PENDING', ct_attempts INTEGER NOT NULL DEFAULT 0, ad_attempts INTEGER NOT NULL DEFAULT 0, ct_error TEXT NOT NULL DEFAULT '', ad_error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_meta_sheet_dual_status ON meta_sheet_dual_queue(ct_status, ad_status, created_at)").run();
}
// This is a one-way SHA-256 fingerprint, never the secret Webhook URL.
const META_SHEETS_ALLOWED_WEBHOOK_HASH = '5581b91b500d9fb0454d2377b8a53968d79d4471f314171d8eeb2d50dd78c57f';
function readConfig(env) {
  let advertiser;
  try { advertiser = new URL(String(env.META_SHEETS_ADVERTISER_URL || 'https://ollymkt.shop/dbapi/')); }
  catch { return null; }
  if (advertiser.protocol !== 'https:' || env.META_SHEETS_DISPATCH_ENABLED === '0') return null;
  return { advertiser: advertiser.href, item: String(env.META_SHEETS_ADVERTISER_ITEM || '64') };
}
export function extractWebhookKey(raw) {
  const value = String(raw || '').trim();
  if (/^ctwh_[A-Za-z0-9_-]{24,110}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== 'pagero.kr') return '';
    const found = /^\/api\/calltag\/v1\/hooks\/(ctwh_[A-Za-z0-9_-]{24,110})$/.exec(url.pathname);
    return found ? found[1] : '';
  } catch { return ''; }
}
async function verifyWebhookAccess(db, rawKey, expectedHash) {
  const key = extractWebhookKey(rawKey);
  if (!key) return null;
  const hash = await sha256(key);
  if (hash !== expectedHash) return null;
  await ensureWebhookSchema(db);
  const active = await db.prepare("SELECT id FROM calltag_webhook_connections WHERE endpoint_hash=? AND status='active' LIMIT 1")
    .bind(hash).first();
  return active?.id ? key : null;
}
export async function onRequest({ request, env, ctx }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false }, METHODS);
  const settings = readConfig(env);
  if (!settings) return jsonResponse(request, env, 503, { ok: false, error: 'NOT_CONFIGURED' }, METHODS);
  try {
    const db = assertD1(env);
    const endpointKey = await verifyWebhookAccess(db, request.headers.get('X-Meta-Relay-Token'),
      String(env.META_SHEETS_EXPECTED_ENDPOINT_HASH || META_SHEETS_ALLOWED_WEBHOOK_HASH));
    if (!endpointKey) return jsonResponse(request, env, 401, { ok: false, error: 'UNAUTHORIZED' }, METHODS);
    const config = { ...settings, endpointKey };
    const raw = await request.text();
    if (raw.length > 128 * 1024) return jsonResponse(request, env, 413, { ok: false }, METHODS);
    const rows = JSON.parse(raw)?.rows;
    if (!Array.isArray(rows) || rows.length > 5) {
      return jsonResponse(request, env, 400, { ok: false, error: 'INVALID_ROWS' }, METHODS);
    }
    // Validate the complete batch before acknowledging it. Bad real leads must
    // remain in the sheet cursor so they can be corrected instead of silently lost.
    const validated = rows.map((row, index) => ({
      lead: normalizeSheetLead(row),
      dummy: isMetaTestLead(row),
      rowIndex: index
    }));
    const invalid = validated.find(item => !item.lead && !item.dummy);
    if (invalid) {
      return jsonResponse(request, env, 422, {
        ok: false, error: 'INVALID_LEAD_ROW', rowIndex: invalid.rowIndex
      }, METHODS);
    }
    await ensureSchema(db);
    for (const { lead } of validated) {
      if (!lead) continue; // Meta dummy lead, deliberately excluded.
      await db.prepare('INSERT OR IGNORE INTO meta_sheet_dual_queue (event_id, payload_json) VALUES (?, ?)')
        .bind(lead.eventId, JSON.stringify(lead)).run();
    }
    const task = dispatchPending(db, env, config);
    if (ctx?.waitUntil) ctx.waitUntil(task); else await task;
    return jsonResponse(request, env, 202, { ok: true, accepted: rows.length }, METHODS);
  } catch (error) {
    console.error('Meta Sheets relay failed', { type: String(error?.name || 'Error') });
    return jsonResponse(request, env, 500, { ok: false, error: 'INGEST_FAILED' }, METHODS);
  }
}
export async function dispatchPending(db, env, config) {
  // A crashed CallTag attempt can safely be retried because its external_id is idempotent.
  await db.prepare("UPDATE meta_sheet_dual_queue SET ct_status='RETRY', updated_at=CURRENT_TIMESTAMP WHERE ct_status='SENDING' AND ct_attempts<3 AND updated_at < datetime('now','-3 minutes')").run();
  // Advertiser delivery must never be retried automatically after an ambiguous send.
  await db.prepare("UPDATE meta_sheet_dual_queue SET ad_status='REVIEW', ad_error='전송 중단: 수동 확인' WHERE ad_status='SENDING' AND updated_at < datetime('now','-3 minutes')").run();
  // One-time, single-ID repair: the account owner confirmed the 2026-11-10 advertiser record
  // was absent. Never auto-replay other leads, never replay SENT, and never exceed 2 attempts.
  const queue = await db.prepare("SELECT event_id, payload_json, ct_status, ad_status FROM meta_sheet_dual_queue WHERE (ct_status IN ('PENDING','RETRY') AND ct_attempts < 3) OR ad_status='PENDING' OR (event_id='meta-l1870743443942053' AND ad_status='REVIEW' AND ad_attempts=1) ORDER BY created_at LIMIT 10").all();
  for (const record of queue.results || []) {
    let lead;
    try { lead = JSON.parse(record.payload_json); } catch { continue; }
    if (record.ct_status === 'PENDING' || record.ct_status === 'RETRY') {
      await sendCallTag(db, env, config, record.event_id, lead);
    }
    const exactRecoveredLead = record.event_id === 'meta-l1870743443942053'
      && record.ad_status === 'REVIEW';
    if (record.ad_status === 'PENDING' || exactRecoveredLead) {
      await sendAdvertiser(db, config, record.event_id, lead, exactRecoveredLead);
    }
  }
  await db.prepare("DELETE FROM meta_sheet_dual_queue WHERE created_at < datetime('now','-14 days') AND ct_status NOT IN ('PENDING','RETRY','SENDING') AND ad_status NOT IN ('PENDING','SENDING')").run();
}
async function setState(db, id, prefix, state, note = '') {
  const field = prefix === 'ct' ? 'ct' : 'ad';
  await db.prepare('UPDATE meta_sheet_dual_queue SET ' + field + '_status=?, ' + field + '_error=?, updated_at=CURRENT_TIMESTAMP WHERE event_id=?')
    .bind(state, note.slice(0,100), id).run();
}
async function sendCallTag(db, env, config, id, lead) {
  const lease = await db.prepare("UPDATE meta_sheet_dual_queue SET ct_status='SENDING', ct_attempts=ct_attempts+1, updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND ct_status IN ('PENDING','RETRY') AND ct_attempts<3").bind(id).run();
  if (!lease.meta?.changes) return;
  const tries = await db.prepare('SELECT ct_attempts FROM meta_sheet_dual_queue WHERE event_id=?').bind(id).first();
  try {
    await ensureWebhookSchema(db);
    const conn = await db.prepare("SELECT id, owner_id FROM calltag_webhook_connections WHERE endpoint_hash=? AND status='active' LIMIT 1")
      .bind(await sha256(config.endpointKey)).first();
    if (!conn) { await setState(db,id,'ct','ERROR','Webhook 연결 없음'); return; }
    const content = [
      lead.content,
      lead.money ? '채무금액: ' + lead.money : '',
      lead.calldate ? '상담가능시간: ' + lead.calldate : '',
      lead.area ? '거주지역: ' + lead.area : ''
    ].filter(Boolean).join('\n');
    const body = {
      external_id: id,
      source: { type: 'custom_webhook', provider: 'meta_sheets', name: 'Meta 개인회생' },
      customer: { name: lead.name, phone: lead.phone, email: lead.email },
      inquiry: { content }, submitted_at: lead.submitted
    };
    const result = await intakeCanonicalLead(db, conn.owner_id, body,
      { idempotencyKey: 'meta-sheet:' + id, connectionId: conn.id });
    await setState(db,id,'ct','SENT');
    if (result.created) {
      try { await notifyUniversalLeadAvailable(env, db, conn.owner_id, { eventId: result.eventId }); }
      catch { /* Push signal is best-effort; canonical lead stays saved. */ }
    }
  } catch {
    await setState(db,id,'ct',Number(tries?.ct_attempts || 3) >= 3 ? 'ERROR' : 'RETRY',
      '콜태그 등록 실패');
  }
}
async function sendAdvertiser(db, config, id, lead, oneTimeRecovery = false) {
  const claimSql = oneTimeRecovery && id === 'meta-l1870743443942053'
    ? "UPDATE meta_sheet_dual_queue SET ad_status='SENDING', ad_attempts=ad_attempts+1, updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND ad_status='REVIEW' AND ad_attempts=1"
    : "UPDATE meta_sheet_dual_queue SET ad_status='SENDING', ad_attempts=ad_attempts+1, updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND ad_status='PENDING'";
  const lease = await db.prepare(claimSql).bind(id).run();
  if (!lease.meta?.changes) return;
  try {
    const res = await fetch(config.advertiser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: advertiserForm(lead, config.item),
      redirect: 'manual',
      signal: AbortSignal.timeout(12000)
    });
    const body = (await res.text()).slice(0,10000);
    await setState(db,id,'ad',
      explicitAdvertiserSuccess(res.status,body) ? 'SENT' : 'REVIEW',
      res.ok ? '광고주 응답 확인 필요' : 'HTTP ' + res.status);
  } catch {
    // Do not duplicate a potentially chargeable advertisement lead.
    await setState(db,id,'ad','REVIEW','광고주 수신 불확실 - 수동 확인 필요');
  }
}
