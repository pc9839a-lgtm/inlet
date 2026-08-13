import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';

const PACKAGE_ID = 'kr.pagero.calltag';
const DEFAULT_REPORT_BUCKET = 'pubsite_prod_9219990116920551949';
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';
let cachedStorageToken = '';
let cachedStorageTokenExpiresAt = 0;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);
    await ensureFinanceSchema(env.DB);

    const bucket = text(env.GOOGLE_PLAY_REPORT_BUCKET, 200) || DEFAULT_REPORT_BUCKET;
    let report = await latestCached(env.DB);
    let syncStatus = report ? 'cached' : 'not_available';
    let syncCode = '';

    try {
      const latest = await latestEarningsObject(env, bucket);
      if (latest?.name) {
        const month = reportMonth(latest.name);
        const generation = text(latest.generation, 80);
        if (!report || report.report_month !== month || text(report.source_generation, 80) !== generation) {
          const summary = await importEarningsObject(env, bucket, latest.name, month);
          await saveSummary(env.DB, summary, generation);
          report = await latestCached(env.DB);
          syncStatus = 'synced';
        } else {
          syncStatus = 'current';
        }
      }
    } catch (error) {
      const code = text(error?.code, 80) || 'PLAY_REPORT_SYNC_FAILED';
      syncCode = code;
      syncStatus = code === 'PLAY_REPORT_PERMISSION_REQUIRED' ? 'permission_required' : 'sync_failed';
      console.warn('calltag-play-finance-sync', code, Number(error?.googleStatus || 0));
    }

    const partner = report?.report_month
      ? await partnerAmounts(env.DB, report.report_month)
      : { confirmedKrw: 0, paidKrw: 0 };

    const playNetKrw = money(report?.net_earnings_krw);
    const partnerConfirmedKrw = money(partner.confirmedKrw);
    const partnerPaidKrw = money(partner.paidKrw);
    const finalAfterPartnerKrw = Math.max(0, playNetKrw - partnerConfirmedKrw);

    await recordAdminAudit(env.DB, request, env, identity, 'play_finance.read');

    return adminJson(200, {
      ok: true,
      available: !!report,
      status: syncStatus,
      code: syncCode,
      report: report ? {
        month: text(report.report_month, 7),
        currency: text(report.currency, 12),
        customerNetKrw: money(report.customer_net_krw),
        googleFeeKrw: money(report.google_fee_krw),
        playNetKrw,
        partnerConfirmedKrw,
        partnerPaidKrw,
        partnerUnpaidKrw: Math.max(0, partnerConfirmedKrw - partnerPaidKrw),
        finalAfterPartnerKrw,
        transactionCount: money(report.transaction_count),
        syncedAt: safeIso(report.synced_at),
        basis: 'google_play_earnings_report',
        finalBankPayout: false,
      } : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function ensureFinanceSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_play_earnings_monthly (
      report_month TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT '',
      customer_net_krw INTEGER NOT NULL DEFAULT 0,
      google_fee_krw INTEGER NOT NULL DEFAULT 0,
      net_earnings_krw INTEGER NOT NULL DEFAULT 0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      source_generation TEXT NOT NULL DEFAULT '',
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function latestCached(db) {
  return db.prepare(`
    SELECT report_month, currency, customer_net_krw, google_fee_krw,
           net_earnings_krw, transaction_count, source_generation, synced_at
    FROM calltag_play_earnings_monthly
    ORDER BY report_month DESC
    LIMIT 1
  `).first();
}

async function saveSummary(db, summary, generation) {
  await db.prepare(`
    INSERT INTO calltag_play_earnings_monthly (
      report_month, currency, customer_net_krw, google_fee_krw,
      net_earnings_krw, transaction_count, source_generation, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(report_month) DO UPDATE SET
      currency = excluded.currency,
      customer_net_krw = excluded.customer_net_krw,
      google_fee_krw = excluded.google_fee_krw,
      net_earnings_krw = excluded.net_earnings_krw,
      transaction_count = excluded.transaction_count,
      source_generation = excluded.source_generation,
      synced_at = CURRENT_TIMESTAMP
  `).bind(
    summary.month,
    summary.currency,
    summary.customerNetKrw,
    summary.googleFeeKrw,
    summary.netEarningsKrw,
    summary.transactionCount,
    generation,
  ).run();
}

async function latestEarningsObject(env, bucket) {
  const token = await storageAccessToken(env);
  const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
  url.searchParams.set('prefix', 'earnings/earnings_');
  url.searchParams.set('maxResults', '100');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw storageError(response.status);
  const items = (Array.isArray(body?.items) ? body.items : [])
    .filter((item) => /^earnings\/earnings_20\d{4}.*\.zip$/i.test(String(item?.name || '')))
    .sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
  return items[0] || null;
}

async function importEarningsObject(env, bucket, objectName, month) {
  const token = await storageAccessToken(env);
  const url = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw storageError(response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw codedError('PLAY_REPORT_FILE_INVALID');
  const csvBytes = await unzipFirstCsv(bytes);
  const csv = decodeReport(csvBytes);
  return summarizeCsv(csv, month);
}

function summarizeCsv(csv, month) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { month, currency: 'KRW', customerNetKrw: 0, googleFeeKrw: 0, netEarningsKrw: 0, transactionCount: 0 };
  const header = rows[0].map(normalizeHeader);
  const packageIndex = findHeader(header, ['packageid', 'productid']);
  const typeIndex = findHeader(header, ['transactiontype']);
  const currencyIndex = findHeader(header, ['merchantcurrency']);
  const amountIndex = findHeader(header, ['amountmerchantcurrency']);
  if ([packageIndex, typeIndex, currencyIndex, amountIndex].some((index) => index < 0)) throw codedError('PLAY_REPORT_COLUMNS_CHANGED');

  let customerNet = 0;
  let feeSigned = 0;
  let total = 0;
  let transactionCount = 0;
  const currencies = new Set();

  for (const row of rows.slice(1)) {
    if (String(row[packageIndex] || '').trim() !== PACKAGE_ID) continue;
    const currency = String(row[currencyIndex] || '').trim().toUpperCase();
    if (!currency) continue;
    currencies.add(currency);
    if (currency !== 'KRW') continue;
    const amount = decimal(row[amountIndex]);
    if (!Number.isFinite(amount)) continue;
    const type = String(row[typeIndex] || '').trim().toLowerCase();
    total += amount;
    transactionCount += 1;
    if (type === 'charge' || type === 'charge refund') customerNet += amount;
    if (type === 'google fee' || type === 'google fee refund') feeSigned += amount;
  }

  if (currencies.size && !currencies.has('KRW')) throw codedError('PLAY_REPORT_NON_KRW');
  return {
    month,
    currency: 'KRW',
    customerNetKrw: Math.round(customerNet),
    googleFeeKrw: Math.max(0, Math.round(-feeSigned)),
    netEarningsKrw: Math.max(0, Math.round(total)),
    transactionCount,
  };
}

async function partnerAmounts(db, month) {
  let confirmedKrw = 0;
  let paidKrw = 0;
  try {
    const confirmed = await db.prepare(`
      SELECT COALESCE(SUM(commission_amount_krw), 0) AS value
      FROM partner_commissions
      WHERE earned_month = ? AND status = 'confirmed'
    `).bind(month).first();
    confirmedKrw = money(confirmed?.value);
  } catch {}
  try {
    const paid = await db.prepare(`
      SELECT COALESCE(SUM(payout_amount_krw), 0) AS value
      FROM partner_settlements
      WHERE settlement_month = ? AND status = 'paid'
    `).bind(month).first();
    paidKrw = money(paid?.value);
  } catch {}
  return { confirmedKrw, paidKrw };
}

async function storageAccessToken(env) {
  if (cachedStorageToken && cachedStorageTokenExpiresAt > Date.now() + 60000) return cachedStorageToken;
  const email = text(env.GOOGLE_PLAY_CLIENT_EMAIL, 320);
  const privateKey = String(env.GOOGLE_PLAY_PRIVATE_KEY || '');
  if (!email || !privateKey) throw codedError('PLAY_REPORT_CREDENTIALS_REQUIRED');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signedJwt(email, privateKey, {
    iss: email,
    scope: STORAGE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) throw codedError('PLAY_REPORT_GOOGLE_AUTH_FAILED');
  cachedStorageToken = String(body.access_token);
  cachedStorageTokenExpiresAt = Date.now() + Math.max(60, Number(body.expires_in || 3600)) * 1000;
  return cachedStorageToken;
}

async function signedJwt(email, privateKey, payload) {
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${header}.${body}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function importPrivateKey(value) {
  const pem = String(value || '').replace(/\\n/g, '\n');
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  if (!base64) throw codedError('PLAY_REPORT_PRIVATE_KEY_REQUIRED');
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function unzipFirstCsv(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findSignature(bytes, 0x06054b50, Math.max(0, bytes.length - 65557));
  if (eocd < 0) throw codedError('PLAY_REPORT_ZIP_INVALID');
  const centralOffset = view.getUint32(eocd + 16, true);
  let cursor = centralOffset;
  for (let i = 0; i < 32 && cursor + 46 <= bytes.length; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    if (/\.csv$/i.test(name)) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw codedError('PLAY_REPORT_ZIP_INVALID');
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) {
        try {
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return new Uint8Array(await new Response(stream).arrayBuffer());
        } catch {
          throw codedError('PLAY_REPORT_ZIP_DEFLATE_UNSUPPORTED');
        }
      }
      throw codedError('PLAY_REPORT_ZIP_METHOD_UNSUPPORTED');
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw codedError('PLAY_REPORT_CSV_NOT_FOUND');
}

function findSignature(bytes, signature, minOffset) {
  for (let i = bytes.length - 22; i >= minOffset; i -= 1) {
    if (bytes[i] === (signature & 0xff) && bytes[i + 1] === ((signature >>> 8) & 0xff) && bytes[i + 2] === ((signature >>> 16) & 0xff) && bytes[i + 3] === ((signature >>> 24) & 0xff)) return i;
  }
  return -1;
}

function decodeReport(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((item) => item.some((value) => String(value || '').trim() !== ''));
}

function normalizeHeader(value) {
  return String(value || '').replace(/^\ufeff/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeader(header, candidates) {
  for (const candidate of candidates) {
    const index = header.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function reportMonth(name) {
  const match = String(name || '').match(/earnings_(20\d{4})/i);
  return match ? `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}` : '';
}

function decimal(value) {
  const parsed = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function storageError(status) {
  const code = Number(status || 0) === 401 || Number(status || 0) === 403
    ? 'PLAY_REPORT_PERMISSION_REQUIRED'
    : Number(status || 0) === 404 ? 'PLAY_REPORT_NOT_FOUND' : 'PLAY_REPORT_STORAGE_FAILED';
  const error = codedError(code);
  error.googleStatus = Number(status || 0);
  return error;
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function money(value) {
  const parsed = Math.round(Number(value || 0));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}
