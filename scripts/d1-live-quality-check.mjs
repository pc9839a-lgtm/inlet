import { readFile } from 'node:fs/promises';

const REQUIRED_TABLES = [
  'accounts',
  'projects',
  'project_members',
  'invites',
  'pages',
  'page_revisions',
  'leads',
  'events',
  'delivery_logs',
  'ai_drafts',
  'ownership_transfer_requests',
  'audit_logs',
  'subscriptions',
  'payments',
];

function status(name, ready, missing = [], extra = {}) {
  return {
    name,
    status: ready ? 'ready' : 'skipped-live',
    missing,
    ...extra,
  };
}

function summarize(items = []) {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

async function readWranglerD1() {
  const raw = await readFile('wrangler.jsonc', 'utf8');
  const config = JSON.parse(raw);
  const db = Array.isArray(config.d1_databases) ? config.d1_databases.find((item) => item.binding === 'DB') : null;
  return {
    databaseId: String(process.env.INLET_D1_DATABASE_ID || db?.database_id || '').trim(),
    databaseName: String(process.env.INLET_D1_DATABASE_NAME || db?.database_name || '').trim(),
  };
}

function cloudflareToken() {
  return String(process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '').trim();
}

async function resolveCloudflareAccountId(token) {
  const explicit = String(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '').trim();
  if (explicit) return { accountId: explicit, source: 'env' };
  if (!token) return { accountId: '', source: 'missing' };

  const res = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=2', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    const message = data?.errors?.map((error) => error.message).join('; ') || `HTTP ${res.status}`;
    const error = new Error(`Cloudflare account lookup failed: ${message}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }
  const accounts = Array.isArray(data?.result) ? data.result : [];
  if (accounts.length === 1 && accounts[0]?.id) return { accountId: String(accounts[0].id), source: 'api-single-account' };
  return { accountId: '', source: accounts.length > 1 ? 'multiple-accounts' : 'not-found', accountCount: accounts.length };
}

async function cloudflareRequest(accountId, path, body = null) {
  const token = cloudflareToken();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    const message = data?.errors?.map((error) => error.message).join('; ') || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.payload = data;
    throw error;
  }
  return data;
}

async function run() {
  const enabled = process.env.INLET_D1_LIVE_QA === '1';
  const token = cloudflareToken();
  const wrangler = await readWranglerD1();
  const explicitAccountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '').trim();
  let account = { accountId: explicitAccountId, source: explicitAccountId ? 'env' : 'missing' };
  if (enabled && token && !account.accountId) {
    try {
      account = await resolveCloudflareAccountId(token);
    } catch (error) {
      return {
        ok: false,
        liveSummary: { 'failed-live': 1 },
        checks: [{
          name: 'Cloudflare D1 live schema',
          status: 'failed-live',
          missing: [],
          error: error?.message || String(error),
          httpStatus: error?.status || 0,
        }],
      };
    }
  }
  const missing = [
    enabled ? '' : 'INLET_D1_LIVE_QA=1',
    account.accountId ? '' : 'CLOUDFLARE_ACCOUNT_ID or single-account CLOUDFLARE_API_TOKEN',
    token ? '' : 'CLOUDFLARE_API_TOKEN',
    wrangler.databaseId ? '' : 'INLET_D1_DATABASE_ID or wrangler DB database_id',
  ].filter(Boolean);

  if (missing.length) {
    return {
      ok: true,
      liveSummary: { 'skipped-live': 1 },
      checks: [status('Cloudflare D1 live schema', false, missing, {
        databaseName: wrangler.databaseName,
        databaseId: wrangler.databaseId,
        accountIdSource: account.source,
        accountCount: account.accountCount,
      })],
    };
  }

  try {
    const database = await cloudflareRequest(account.accountId, `/d1/database/${wrangler.databaseId}`);
    const tablesRes = await cloudflareRequest(account.accountId, `/d1/database/${wrangler.databaseId}/query`, {
      sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    });
    const countRes = await cloudflareRequest(account.accountId, `/d1/database/${wrangler.databaseId}/query`, {
      sql: "SELECT 'accounts' AS table_name, COUNT(*) AS count FROM accounts UNION ALL SELECT 'projects', COUNT(*) FROM projects UNION ALL SELECT 'leads', COUNT(*) FROM leads UNION ALL SELECT 'events', COUNT(*) FROM events UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs",
    });
    const tableNames = new Set((tablesRes.result?.[0]?.results || []).map((row) => row.name));
    const missingTables = REQUIRED_TABLES.filter((table) => !tableNames.has(table));
    const ready = missingTables.length === 0;
    return {
      ok: ready,
      liveSummary: summarize([{
        status: ready ? 'ready' : 'failed-live',
      }]),
      checks: [{
        name: 'Cloudflare D1 live schema',
        status: ready ? 'ready' : 'failed-live',
        missing: missingTables,
        database: {
          name: database.result?.name || wrangler.databaseName,
          uuid: database.result?.uuid || wrangler.databaseId,
          version: database.result?.version || '',
          numTables: database.result?.num_tables || tableNames.size,
        },
        accountIdSource: account.source,
        tableCount: tableNames.size,
        counts: countRes.result?.[0]?.results || [],
      }],
    };
  } catch (error) {
    return {
      ok: false,
      liveSummary: { 'failed-live': 1 },
      checks: [{
        name: 'Cloudflare D1 live schema',
        status: 'failed-live',
        missing: [],
        error: error?.message || String(error),
        httpStatus: error?.status || 0,
      }],
    };
  }
}

const result = await run();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
