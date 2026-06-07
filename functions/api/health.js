import { createStorageRuntime, storageRuntimeCoverage, storageRuntimeHealth } from '../../server/storage/runtimeAdapter.mjs';

function parseAllowedOrigins(value = '') {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function sessionSource(mode = '') {
  const normalized = String(mode || 'production').trim().toLowerCase();
  if (normalized === 'production' || normalized === 'strict') {
    return {
      sessionMode: normalized,
      sourceOfTruth: 'signed-session',
      hostedAuthImplemented: false,
      devHeadersAccepted: false,
    };
  }
  if (normalized === 'hosted') {
    return {
      sessionMode: normalized,
      sourceOfTruth: 'hosted-auth-unimplemented',
      hostedAuthImplemented: false,
      devHeadersAccepted: false,
    };
  }
  return {
    sessionMode: normalized || 'dev-headers',
    sourceOfTruth: 'dev-headers',
    hostedAuthImplemented: false,
    devHeadersAccepted: true,
  };
}

function corsHeaders(request, env = {}) {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseAllowedOrigins(env.INLET_ALLOWED_ORIGINS || '');
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || 'https://pagero.kr';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request, env, status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env),
    },
  });
}

function envFirst(env = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== 'GET') {
    return json(request, env, 405, { ok: false, error: 'Method not allowed.' });
  }

  const storageRuntime = createStorageRuntime({
    ...env,
    INLET_STORAGE_ADAPTER: env.INLET_STORAGE_ADAPTER || 'd1',
  });
  const auth = sessionSource(env.INLET_SESSION_AUTH_MODE || 'production');
  const authEmailModeInput = String(env.INLET_AUTH_EMAIL_MODE || 'mock').trim().toLowerCase();
  const authEmailMode = authEmailModeInput === 'api' || authEmailModeInput === 'ses' ? 'api' : 'mock';
  const authEmailProvider = authEmailMode === 'api' ? String(env.INLET_EMAIL_PROVIDER || 'ses').trim().toLowerCase() : 'mock';
  const sesRegion = envFirst(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2');
  const sesAccessKey = envFirst(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const sesSecretKey = envFirst(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const sesFrom = envFirst(env, ['INLET_AUTH_EMAIL_FROM', 'INLET_LEAD_EMAIL_FROM', 'AWS_SES_FROM'], '페이지로 <support@pagero.kr>');
  const sesReady = !!(
    sesRegion &&
    sesAccessKey &&
    sesSecretKey &&
    sesFrom
  );

  return json(request, env, 200, {
    ok: true,
    service: 'inlet-api',
    mode: 'pages-functions',
    auth: {
      projectEnforced: env.INLET_PROJECT_AUTH_ENFORCE !== '0',
      sessionMode: auth.sessionMode,
      sourceOfTruth: auth.sourceOfTruth,
      hostedAuthImplemented: auth.hostedAuthImplemented,
      signedSessionReady: !!String(env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret').trim(),
      devHeadersAccepted: auth.devHeadersAccepted,
      emailDeliveryMode: authEmailMode,
      emailDeliveryProvider: authEmailProvider,
      emailDeliveryReady: authEmailMode === 'mock' || (authEmailProvider === 'ses' && sesReady),
    },
    storage: {
      ...storageRuntimeHealth(storageRuntime),
      coverage: storageRuntimeCoverage(storageRuntime),
    },
  });
}
