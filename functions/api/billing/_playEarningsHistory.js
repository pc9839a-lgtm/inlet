import { ensurePaymentHistorySchema, orderFamily, recordPaymentEvent } from './_paymentHistory.js';

const PACKAGE_ID = 'kr.pagero.calltag';
const DEFAULT_REPORT_BUCKET = 'pubsite_prod_9219990116920551949';
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';
let cachedStorageToken = '';
let cachedStorageTokenExpiresAt = 0;

export async function syncPlayEarningsHistory(env, db, requestedMonth = '', backfillLimit = 2) {
  await ensureSchemas(db);
  const bucket = text(env.GOOGLE_PLAY_REPORT_BUCKET, 200) || DEFAULT_REPORT_BUCKET;
  const groups = await listEarningsGroups(env, bucket);
  const cached = await cachedReports(db);
  const months = Array.from(new Set([...groups.keys(), ...cached.keys()])).sort().reverse();
  const requested = validMonth(requestedMonth);
  const selectedMonth = requested && months.includes(requested) ? requested : (months[0] || '');

  let syncedCount = 0;
  if (selectedMonth && groups.has(selectedMonth)) {
    const changed = await syncMonthIfNeeded(env, db, bucket, selectedMonth, groups.get(selectedMonth), cached.get(selectedMonth));
    if (changed) syncedCount += 1;
  }

  const freshCached = await cachedReports(db);
  const candidates = Array.from(groups.keys()).sort().reverse().filter((month) => {
    if (month === selectedMonth) return false;
    const objects = groups.get(month) || [];
    const existing = freshCached.get(month);
    return !existing || existing.source_generation !== objectSignature(objects);
  });
  const limit = Math.max(0, Math.min(4, Math.trunc(Number(backfillLimit || 0))));
  for (const month of candidates.slice(0, limit)) {
    const changed = await syncMonthIfNeeded(env, db, bucket, month, groups.get(month), freshCached.get(month));
    if (changed) syncedCount += 1;
  }

  const finalCached = await cachedReports(db);
  const finalMonths = Array.from(new Set([...groups.keys(), ...finalCached.keys()])).sort().reverse();
  const report = selectedMonth ? finalCached.get(selectedMonth) || null : null;
  const remaining = Array.from(groups.keys()).filter((month) => {
    const row = finalCached.get(month);
    return !row || row.source_generation !== objectSignature(groups.get(month) || []);
  }).length;

  return {
    month: selectedMonth,
    months: finalMonths,
    report: report ? publicReport(report) : null,
    syncedCount,
    backfillRemaining: remaining,
  };
}

export async function ensureSchemas(db) {
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
  await ensurePaymentHistorySchema(db);
}

async function syncMonthIfNeeded(env, db, bucket, month, objects = [], existing = null) {
  if (!objects.length) return false;
  const signature = objectSignature(objects);
  if (existing?.source_generation === signature) return false;
  const combined = { month, currency: 'KRW', customerNetKrw: 0, googleFeeKrw: 0, netEarningsKrw: 0, transactionCount: 0, events: [] };
  for (const object of objects) {
    const one = await importEarningsObject(env, bucket, object.name, month);
    combined.customerNetKrw += one.customerNetKrw;
    combined.googleFeeKrw += one.googleFeeKrw;
    combined.netEarningsKrw += one.netEarningsKrw;
    combined.transactionCount += one.transactionCount;
    combined.events.push(...one.events);
  }
  await saveSummary(db, combined, signature);
  await reconcilePaymentEvents(db, combined.events, month);
  return true;
}

async function cachedReports(db) {
  const result = await db.prepare(`
    SELECT report_month, currency, customer_net_krw, google_fee_krw,
           net_earnings_krw, transaction_count, source_generation, synced_at
    FROM calltag_play_earnings_monthly
    ORDER BY report_month DESC
  `).all();
  const map = new Map();
  for (const row of (Array.isArray(result?.results) ? result.results : [])) {
    const month = validMonth(row.report_month);
    if (month) map.set(month, row);
  }
  return map;
}

async function saveSummary(db, summary, signature) {
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
    money(summary.customerNetKrw),
    money(summary.googleFeeKrw),
    money(summary.netEarningsKrw),
    Math.max(0, Math.trunc(Number(summary.transactionCount || 0))),
    signature,
  ).run();
}

async function reconcilePaymentEvents(db, events, month) {
  if (!events.length) return;
  const subscriptions = await db.prepare(`
    SELECT id, owner_id, product_code, order_id
    FROM billing_subscriptions
    WHERE channel = 'google_play' AND COALESCE(order_id, '') != ''
  `).all();
  const byFamily = new Map();
  for (const row of (Array.isArray(subscriptions?.results) ? subscriptions.results : [])) {
    const family = orderFamily(row.order_id);
    if (!family) continue;
    const key = `${family}:${token(row.product_code, 120)}`;
    byFamily.set(key, row);
    if (!byFamily.has(family)) byFamily.set(family, row);
  }
  for (const event of events.slice(0, 5000)) {
    const family = orderFamily(event.orderId);
    if (!family) continue;
    const subscription = byFamily.get(`${family}:${event.productCode}`) || byFamily.get(family);
    if (!subscription?.owner_id) continue;
    await recordPaymentEvent(db, {
      ownerId: subscription.owner_id,
      subscriptionId: subscription.id,
      productCode: event.productCode || subscription.product_code,
      channel: 'google_play',
      eventType: event.eventType,
      paymentReference: event.orderId,
      amountKrw: event.amountKrw,
      amountSource: 'play_earnings_report',
      paymentStatus: event.status,
      paidAt: event.paidAt,
      sourceMonth: month,
    });
  }
}

async function listEarningsGroups(env, bucket) {
  const tokenValue = await storageAccessToken(env);
  const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
  url.searchParams.set('prefix', 'earnings/earnings_');
  url.searchParams.set('maxResults', '1000');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${tokenValue}`, Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw storageError(response.status);
  const groups = new Map();
  for (const item of (Array.isArray(body?.items) ? body.items : [])) {
    const name = String(item?.name || '');
    const match = name.match(/^earnings\/earnings_(20\d{2})(0[1-9]|1[0-2]).*\.zip$/i);
    if (!match) continue;
    const month = `${match[1]}-${match[2]}`;
    const list = groups.get(month) || [];
    list.push({ name, generation: text(item?.generation, 80) });
    groups.set(month, list);
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

function objectSignature(objects = []) {
  return objects.map((item) => `${item.name}:${item.generation}`).join('|').slice(0, 4000);
}

async function importEarningsObject(env, bucket, objectName, month) {
  const tokenValue = await storageAccessToken(env);
  const url = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${tokenValue}` } });
  if (!response.ok) throw storageError(response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw codedError('PLAY_REPORT_FILE_INVALID');
  const csvBytes = await unzipFirstCsv(bytes);
  return summarizeCsv(decodeReport(csvBytes), month);
}

function summarizeCsv(csv, month) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { month, currency: 'KRW', customerNetKrw: 0, googleFeeKrw: 0, netEarningsKrw: 0, transactionCount: 0, events: [] };
  const header = rows[0].map(normalizeHeader);
  const descriptionIndex = findHeader(header, ['description']);
  const packageIndex = findHeader(header, ['packageid']);
  const productIndex = findHeader(header, ['skuid', 'productid']);
  const typeIndex = findHeader(header, ['transactiontype']);
  const refundTypeIndex = findHeader(header, ['refundtype']);
  const dateIndex = findHeader(header, ['transactiondate']);
  const currencyIndex = findHeader(header, ['merchantcurrency']);
  const amountIndex = findHeader(header, ['amountmerchantcurrency']);
  if ([descriptionIndex, packageIndex, typeIndex, currencyIndex, amountIndex].some((index) => index < 0)) throw codedError('PLAY_REPORT_COLUMNS_CHANGED');

  let customerNet = 0;
  let feeSigned = 0;
  let total = 0;
  let transactionCount = 0;
  const events = [];

  for (const row of rows.slice(1)) {
    if (String(row[packageIndex] || '').trim() !== PACKAGE_ID) continue;
    const currency = String(row[currencyIndex] || '').trim().toUpperCase();
    if (currency !== 'KRW') continue;
    const amount = decimal(row[amountIndex]);
    if (!Number.isFinite(amount)) continue;
    const type = String(row[typeIndex] || '').trim().toLowerCase();
    total += amount;
    transactionCount += 1;
    if (type === 'charge' || type === 'charge refund' || type === 'charge rebill') customerNet += amount;
    if (type === 'google fee' || type === 'google fee refund' || type === 'google fee rebill') feeSigned += amount;

    const isCharge = type === 'charge' || type === 'charge rebill';
    const isRefund = type === 'charge refund';
    if (!isCharge && !isRefund) continue;
    const orderId = text(row[descriptionIndex], 240);
    if (!/^GPA\.[A-Za-z0-9.-]+$/i.test(orderId)) continue;
    const productCode = productIndex >= 0 ? token(row[productIndex], 120) : '';
    const refundType = refundTypeIndex >= 0 ? String(row[refundTypeIndex] || '').trim().toLowerCase() : '';
    events.push({
      orderId,
      productCode,
      eventType: isRefund ? 'refund' : 'charge',
      amountKrw: Math.abs(Math.round(amount)),
      status: isRefund ? (refundType === 'partial' ? 'partial_refund' : 'refunded') : 'paid',
      paidAt: dateIndex >= 0 ? reportDate(row[dateIndex]) : '',
    });
  }

  return {
    month,
    currency: 'KRW',
    customerNetKrw: Math.round(customerNet),
    googleFeeKrw: Math.max(0, Math.round(-feeSigned)),
    netEarningsKrw: Math.max(0, Math.round(total)),
    transactionCount,
    events,
  };
}

function publicReport(row) {
  return {
    month: validMonth(row.report_month),
    currency: token(row.currency, 12),
    customerNetKrw: money(row.customer_net_krw),
    googleFeeKrw: money(row.google_fee_krw),
    playNetKrw: money(row.net_earnings_krw),
    transactionCount: Math.max(0, Math.trunc(Number(row.transaction_count || 0))),
    syncedAt: iso(row.synced_at),
  };
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
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth-type:jwt-bearer', assertion }),
  }).catch(() => null);
  if (!response) throw codedError('PLAY_REPORT_GOOGLE_AUTH_NETWORK_FAILED');
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) {
    const retry = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    }).catch(() => null);
    if (!retry) throw codedError('PLAY_REPORT_GOOGLE_AUTH_NETWORK_FAILED');
    const retryBody = await retry.json().catch(() => ({}));
    if (!retry.ok || !retryBody?.access_token) throw codedError('PLAY_REPORT_GOOGLE_AUTH_FAILED');
    cachedStorageToken = String(retryBody.access_token);
    cachedStorageTokenExpiresAt = Date.now() + Math.max(60, Number(retryBody.expires_in || 3600)) * 1000;
    return cachedStorageToken;
  }
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
  for (let i = 0; i < 64 && cursor + 46 <= bytes.length; i += 1) {
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
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').replace(/^\ufeff/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeader(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function decimal(value) {
  const raw = String(value || '').replace(/,/g, '').trim();
  const number = Number(raw);
  return Number.isFinite(number) ? number : NaN;
}

function reportDate(value) {
  const parsed = Date.parse(String(value || '').trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function storageError(status) {
  if (Number(status) === 401 || Number(status) === 403) return codedError('PLAY_REPORT_PERMISSION_REQUIRED');
  const error = codedError('PLAY_REPORT_STORAGE_FAILED');
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
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function validMonth(value) {
  const raw = String(value || '').trim();
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '';
}

function iso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function token(value, max = 120) {
  const raw = String(value ?? '').trim();
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw.slice(0, max) : '';
}
