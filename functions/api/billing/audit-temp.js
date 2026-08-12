import { assertD1 } from '../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const db = assertD1(env);
  const rows = await db.prepare(`
    SELECT
      id,
      product_code,
      channel,
      status,
      verification_state,
      auto_renewing,
      last_verified_at,
      created_at,
      updated_at,
      expires_at
    FROM billing_subscriptions
    WHERE channel = 'google_play'
    ORDER BY id DESC
    LIMIT 5
  `).all();

  const safeRows = (Array.isArray(rows?.results) ? rows.results : []).map((row) => ({
    id: Number(row.id || 0),
    productCode: String(row.product_code || ''),
    channel: String(row.channel || ''),
    status: String(row.status || ''),
    verificationState: String(row.verification_state || ''),
    autoRenewing: Number(row.auto_renewing || 0) === 1,
    lastVerifiedAt: String(row.last_verified_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    expiresAt: String(row.expires_at || ''),
  }));

  return new Response(JSON.stringify({
    ok: true,
    serverNow: new Date().toISOString(),
    count: safeRows.length,
    rows: safeRows,
  }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
