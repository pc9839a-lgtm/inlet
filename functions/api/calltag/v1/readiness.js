const REQUIRED_TABLES = Object.freeze([
  'calltag_lead_customers',
  'calltag_lead_events',
  'calltag_api_keys',
  'calltag_lead_audit',
  'calltag_webhook_connections',
  'calltag_webhook_mapping_versions',
  'calltag_webhook_raw_events',
  'calltag_meta_connections',
  'calltag_meta_oauth_sessions',
  'calltag_google_forms_oauth_sessions',
  'calltag_google_forms_connections',
  'calltag_push_devices',
  'calltag_pagero_leads',
]);

function json(status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function present(env = {}, keys = []) {
  return keys.some((key) => String(env[key] || '').trim().length > 0);
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function d1Readiness(db) {
  const startedAt = Date.now();
  if (!db?.prepare) {
    return {
      ready: false,
      bindingReady: false,
      queryReady: false,
      schemaReady: false,
      missingTables: [...REQUIRED_TABLES],
      latencyMs: Date.now() - startedAt,
      reason: 'd1-binding-missing',
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
        latencyMs: Date.now() - startedAt,
        reason: 'd1-query-unexpected-result',
      };
    }

    const placeholders = REQUIRED_TABLES.map(() => '?').join(', ');
    const result = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name IN (${placeholders})
    `).bind(...REQUIRED_TABLES).all();

    const found = new Set(rows(result).map((row) => String(row?.name || '').trim()).filter(Boolean));
    const missingTables = REQUIRED_TABLES.filter((name) => !found.has(name));
    return {
      ready: missingTables.length === 0,
      bindingReady: true,
      queryReady: true,
      schemaReady: missingTables.length === 0,
      missingTables,
      latencyMs: Date.now() - startedAt,
      reason: missingTables.length ? 'calltag-schema-incomplete' : 'ready',
    };
  } catch (error) {
    return {
      ready: false,
      bindingReady: true,
      queryReady: false,
      schemaReady: false,
      missingTables: [],
      latencyMs: Date.now() - startedAt,
      reason: 'd1-query-failed',
      errorName: String(error?.name || 'Error').slice(0, 64),
      errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
    };
  }
}

function runtimeReadiness(env = {}) {
  const sessionReady = present(env, ['INLET_SESSION_SECRET_V2', 'INLET_SESSION_SECRET', 'INLET_API_TOKEN']);
  const providerCredentialKeyReady = String(env.CALLTAG_PROVIDER_CREDENTIAL_KEY || '').trim().length >= 32;
  const googleClientIdReady = present(env, ['GOOGLE_AUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID']);
  const googleClientSecretReady = present(env, ['GOOGLE_AUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET']);
  const metaAppIdReady = present(env, ['CALLTAG_META_APP_ID']);
  const metaAppSecretReady = present(env, ['CALLTAG_META_APP_SECRET']);
  const metaRedirectReady = present(env, ['CALLTAG_META_OAUTH_REDIRECT_URI']);
  const firebaseProjectReady = present(env, ['FIREBASE_PROJECT_ID']);
  const firebaseClientReady = present(env, ['FIREBASE_CLIENT_EMAIL']);
  const firebaseKeyReady = present(env, ['FIREBASE_PRIVATE_KEY']);

  return {
    session: {
      ready: sessionReady,
      valuesExposed: false,
    },
    providerCredentialEncryption: {
      ready: providerCredentialKeyReady,
      valuesExposed: false,
    },
    googleForms: {
      clientIdReady: googleClientIdReady,
      clientSecretReady: googleClientSecretReady,
      nativeOauthReady: googleClientIdReady && googleClientSecretReady && providerCredentialKeyReady,
      bridgeReady: true,
      valuesExposed: false,
    },
    meta: {
      appIdReady: metaAppIdReady,
      appSecretReady: metaAppSecretReady,
      redirectUriReady: metaRedirectReady,
      oauthReady: metaAppIdReady && metaAppSecretReady && metaRedirectReady && providerCredentialKeyReady,
      valuesExposed: false,
    },
    firebase: {
      ready: firebaseProjectReady && firebaseClientReady && firebaseKeyReady,
      projectIdReady: firebaseProjectReady,
      clientEmailReady: firebaseClientReady,
      privateKeyReady: firebaseKeyReady,
      valuesExposed: false,
    },
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return json(405, { ok: false, ready: false, error: 'Method not allowed.' });
  }

  const runtimeEnv = env && typeof env === 'object' ? env : {};
  const [d1, runtime] = await Promise.all([
    d1Readiness(runtimeEnv.DB),
    Promise.resolve(runtimeReadiness(runtimeEnv)),
  ]);

  const coreReady = d1.bindingReady === true
    && d1.queryReady === true
    && runtime.session.ready === true;

  const externalCrudReady = coreReady
    && d1.schemaReady === true
    && runtime.providerCredentialEncryption.ready === true;

  const ready = externalCrudReady && runtime.googleForms.nativeOauthReady === true;

  return json(ready ? 200 : 503, {
    ok: ready,
    ready,
    service: 'calltag-external-integrations',
    checkedAt: new Date().toISOString(),
    checks: {
      d1,
      ...runtime,
      coreReady,
      externalCrudReady,
      metaRequiredForCore: false,
    },
  });
}
