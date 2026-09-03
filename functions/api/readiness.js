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
  const sessionSecret = String(env.INLET_SESSION_SECRET || '').trim();
  if (sessionSecret) return { ready: true, source: 'session-secret' };
  const apiToken = String(env.INLET_API_TOKEN || '').trim();
  if (apiToken) return { ready: true, source: 'api-token' };
  return { ready: false, source: 'missing' };
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

  const [d1, session] = await Promise.all([
    checkD1(env?.DB),
    Promise.resolve(explicitSessionSecret(env)),
  ]);
  const ready = d1.ready === true && session.ready === true;

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
    },
  });
}
