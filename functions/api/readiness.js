const REQUIRED_D1_TABLES = Object.freeze(['accounts', 'projects', 'pages', 'leads']);

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function explicitSessionSecret(env = {}) {
  const sessionSecretV2 = String(env.INLET_SESSION_SECRET_V2 || '').trim();
  if (sessionSecretV2) return { ready: true, source: 'session-secret-v2' };
  const sessionSecret = String(env.INLET_SESSION_SECRET || '').trim();
  if (sessionSecret) return { ready: true, source: 'session-secret' };
  const apiToken = String(env.INLET_API_TOKEN || '').trim();
  if (apiToken) return { ready: true, source: 'api-token' };
  return { ready: false, source: 'missing' };
}

function envFirst(env = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

function authEmailReadiness(env = {}) {
  const mode = String(env.INLET_AUTH_EMAIL_MODE || '').trim().toLowerCase();
  const provider = String(env.INLET_EMAIL_PROVIDER || '').trim().toLowerCase();
  const region = envFirst(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2').toLowerCase();
  const accessKeyPresent = !!envFirst(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretKeyPresent = !!envFirst(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const sender = envFirst(env, ['INLET_AUTH_EMAIL_FROM', 'INLET_LEAD_EMAIL_FROM', 'AWS_SES_FROM']);
  const senderEmail = String(sender.match(/<([^<>]+)>/)?.[1] || sender).trim();
  const regionReady = /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region);
  const senderReady = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(senderEmail);
  const modeReady = mode === 'api' || mode === 'ses';
  const providerReady = provider === 'ses';
  const ready = modeReady && providerReady && regionReady && accessKeyPresent && secretKeyPresent && senderReady;

  let reason = 'ready';
  if (!modeReady) reason = 'auth-email-mode-invalid';
  else if (!providerReady) reason = 'auth-email-provider-invalid';
  else if (!regionReady) reason = 'ses-region-invalid';
  else if (!accessKeyPresent) reason = 'ses-access-key-missing';
  else if (!secretKeyPresent) reason = 'ses-secret-key-missing';
  else if (!senderReady) reason = 'auth-email-sender-invalid';

  return {
    ready,
    modeReady,
    providerReady,
    regionReady,
    accessKeyPresent,
    secretKeyPresent,
    senderReady,
    reason,
    valuesExposed: false,
  };
}

function rowsFromD1Result(result) {
  if (Array.isArray(result?.results)) return result.results;
  if (Array.isArray(result)) return result;
  return [];
}

async function checkD1(db) {
  const startedAt = Date.now();
  if (!db || typeof db.prepare !== 'function') {
    return {
      ready: false,
      bindingReady: false,
      queryReady: false,
      schemaReady: false,
      missingTables: [...REQUIRED_D1_TABLES],
      reason: 'd1-binding-missing',
      latencyMs: Date.now() - startedAt,
    };
  }

  try {
    const ping = await db.prepare('SELECT 1 AS ok').first();
    if (Number(ping?.ok || 0) !== 1) {
      return {
        ready: false,
        bindingReady: true,
        queryReady: false,
        schemaReady: false,
        missingTables: [],
        reason: 'd1-query-unexpected-result',
        latencyMs: Date.now() - startedAt,
      };
    }

    const placeholders = REQUIRED_D1_TABLES.map(() => '?').join(', ');
    const schemaResult = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name IN (${placeholders})
    `).bind(...REQUIRED_D1_TABLES).all();
    const tableNames = new Set(
      rowsFromD1Result(schemaResult)
        .map((row) => String(row?.name || '').trim())
        .filter(Boolean),
    );
    const missingTables = REQUIRED_D1_TABLES.filter((name) => !tableNames.has(name));
    const schemaReady = missingTables.length === 0;

    return {
      ready: schemaReady,
      bindingReady: true,
      queryReady: true,
      schemaReady,
      missingTables,
      reason: schemaReady ? 'ready' : 'd1-schema-incomplete',
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ready: false,
      bindingReady: true,
      queryReady: false,
      schemaReady: false,
      missingTables: [],
      reason: 'd1-query-failed',
      errorName: String(error?.name || 'Error').slice(0, 64),
      errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return jsonResponse(405, {
      ok: false,
      ready: false,
      error: 'Method not allowed.',
    });
  }

  const runtimeEnv = env && typeof env === 'object' ? env : {};
  const [d1, session, authEmail] = await Promise.all([
    checkD1(runtimeEnv.DB),
    Promise.resolve(explicitSessionSecret(runtimeEnv)),
    Promise.resolve(authEmailReadiness(runtimeEnv)),
  ]);
  const ready = d1.ready === true && session.ready === true && authEmail.ready === true;

  return jsonResponse(ready ? 200 : 503, {
    ok: ready,
    ready,
    service: 'pagero-api',
    mode: 'pages-functions',
    checkedAt: new Date().toISOString(),
    checks: {
      d1,
      session: {
        ready: session.ready,
        source: session.source,
        insecureFallbackEnabled: false,
      },
      authEmail,
      runtimeBindings: {
        sessionSecretV2PropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'INLET_SESSION_SECRET_V2'),
        sessionSecretPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'INLET_SESSION_SECRET'),
        apiTokenPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'INLET_API_TOKEN'),
        d1PropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'DB'),
        filesBucketPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'FILES_BUCKET'),
        configuredVarPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'INLET_AUTH_EMAIL_MODE'),
        sesAccessKeyPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'AWS_SES_ACCESS_KEY_ID'),
        sesSecretKeyPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'AWS_SES_SECRET_ACCESS_KEY'),
        authEmailFromPropertyPresent: Object.prototype.hasOwnProperty.call(runtimeEnv, 'INLET_AUTH_EMAIL_FROM'),
        valuesExposed: false,
      },
    },
  });
}
