import { assertD1 } from '../../../../_shared.js';
import { handleMetaOauthCallback, safeMetaOauthReturnPath, sha256 } from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const db = assertD1(env);
    const url = new URL(request.url);
    const rawState = String(url.searchParams.get('state') || '').trim();
    if (rawState && rawState.length <= 512) {
      const stateHash = await sha256(rawState);
      const row = await db.prepare(`
        SELECT status, return_path FROM calltag_meta_oauth_sessions WHERE state_hash = ? LIMIT 1
      `).bind(stateHash).first();
      if (row?.status && String(row.status) !== 'pending') {
        const target = new URL(safeMetaOauthReturnPath(row.return_path || '/connect'), url.origin);
        target.searchParams.set('meta', 'error');
        target.searchParams.set('reason', 'replay');
        return Response.redirect(target.toString(), 302);
      }
    }
    return await handleMetaOauthCallback(db, request, env);
  } catch {
    const target = new URL('/connect', new URL(request.url).origin);
    target.searchParams.set('meta', 'error');
    target.searchParams.set('reason', 'server');
    return Response.redirect(target.toString(), 302);
  }
}
