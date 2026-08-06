function json(status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function safeError(error) {
  return String(error?.message || error || 'unknown error').slice(0, 500);
}

async function runDiagnostic(env) {
  if (!env.DB?.prepare) {
    return json(200, { ok: false, code: 'D1_BINDING_MISSING' });
  }

  const id = `auth-storage-diagnostic-${crypto.randomUUID()}`;
  const email = `${id}@example.invalid`;
  const purpose = 'signup';
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const stages = {};
  let columns = [];
  let indexes = [];

  try {
    const info = await env.DB.prepare('PRAGMA table_info(auth_email_verifications)').all();
    columns = (info?.results || []).map((row) => ({
      name: String(row.name || ''),
      type: String(row.type || ''),
      notnull: Number(row.notnull || 0),
      defaultValue: row.dflt_value ?? null,
      primaryKey: Number(row.pk || 0),
    }));
    stages.tableInfo = { ok: true, count: columns.length };
  } catch (error) {
    stages.tableInfo = { ok: false, error: safeError(error) };
  }

  try {
    const result = await env.DB.prepare('PRAGMA index_list(auth_email_verifications)').all();
    indexes = (result?.results || []).map((row) => ({
      name: String(row.name || ''),
      unique: Number(row.unique || 0),
      origin: String(row.origin || ''),
    }));
    stages.indexList = { ok: true, count: indexes.length };
  } catch (error) {
    stages.indexList = { ok: false, error: safeError(error) };
  }

  try {
    await env.DB.prepare(`
      UPDATE auth_email_verifications
      SET status = 'expired'
      WHERE email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
    `).bind(email, purpose).run();
    stages.updateExisting = { ok: true };
  } catch (error) {
    stages.updateExisting = { ok: false, error: safeError(error) };
  }

  try {
    await env.DB.prepare(`
      INSERT INTO auth_email_verifications (id, email, purpose, code_hash, status, attempts, expires_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).bind(id, email, purpose, 'diagnostic-code-hash', expiresAt).run();
    stages.insert = { ok: true };
  } catch (error) {
    stages.insert = { ok: false, error: safeError(error) };
  }

  try {
    await env.DB.prepare('DELETE FROM auth_email_verifications WHERE id = ?').bind(id).run();
    stages.cleanup = { ok: true };
  } catch (error) {
    stages.cleanup = { ok: false, error: safeError(error) };
  }

  const ok = stages.tableInfo?.ok === true
    && columns.length > 0
    && stages.updateExisting?.ok === true
    && stages.insert?.ok === true
    && stages.cleanup?.ok === true;

  return json(200, {
    ok,
    databaseBinding: 'DB',
    syntheticOnly: true,
    userRowsRead: false,
    columns,
    indexes,
    stages,
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET' || request.method === 'POST') {
    return runDiagnostic(env);
  }
  return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'POST'] });
}
