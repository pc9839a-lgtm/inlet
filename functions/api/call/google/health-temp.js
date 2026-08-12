import { googleClientId, googleLoginConfigured } from './_shared.js';

const EXPECTED_SERVER_CLIENT_ID = '31346298247-o5jfdetjs84mu02c8tp68qg19ifo89en.apps.googleusercontent.com';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const clientId = googleClientId(env);
  let jwksStatus = 0;
  let jwksReachable = false;
  let jwksKeyCount = 0;
  try {
    const google = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' } });
    jwksStatus = Number(google.status || 0);
    const body = await google.json().catch(() => ({}));
    jwksKeyCount = Array.isArray(body?.keys) ? body.keys.length : 0;
    jwksReachable = google.ok && jwksKeyCount > 0;
  } catch (error) {
    jwksStatus = 0;
  }

  return response(200, {
    ok: true,
    nativeClientIdConfigured: !!clientId,
    nativeClientIdMatchesApp: clientId === EXPECTED_SERVER_CLIENT_ID,
    legacyOAuthConfigured: googleLoginConfigured(env),
    jwksReachable,
    jwksStatus,
    jwksKeyCount,
    nativeLoginReady: !!clientId && clientId === EXPECTED_SERVER_CLIENT_ID && jwksReachable,
  });
}

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
