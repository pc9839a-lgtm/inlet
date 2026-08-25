import { assertD1 } from '../../../../_shared.js';
import { handleMetaOauthCallback } from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }
  try {
    return await handleMetaOauthCallback(assertD1(env), request, env);
  } catch {
    const target = new URL('/connect', new URL(request.url).origin);
    target.searchParams.set('meta', 'error');
    target.searchParams.set('reason', 'server');
    return Response.redirect(target.toString(), 302);
  }
}
