import { readFile } from 'node:fs/promises';

const writeEnabled = process.env.INLET_D1_QA_CLEANUP_WRITE === '1';
const approval = String(process.env.INLET_D1_QA_CLEANUP_APPROVAL || '');
const projectPrefix = String(process.env.INLET_D1_QA_CLEANUP_PROJECT_PREFIX || 'hosted-route-qa-').trim();
const emailDomain = String(process.env.INLET_D1_QA_CLEANUP_EMAIL_DOMAIN || 'inlet.test').trim().toLowerCase();

function status(name, ready, missing = [], extra = {}) {
  return { name, status: ready ? 'ready' : 'skipped-live', missing, ...extra };
}

function summarize(checks = []) {
  return checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
}

async function wranglerDatabaseId() {
  const explicit = String(process.env.INLET_D1_DATABASE_ID || '').trim();
  if (explicit) return explicit;
  const raw = await readFile('wrangler.jsonc', 'utf8').catch(() => '');
  const match = raw.match(/"database_id"\s*:\s*"([^"]+)"/);
  return match ? match[1] : '';
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
    throw new Error(`Cloudflare account lookup failed: ${message}`);
  }
  const accounts = Array.isArray(data?.result) ? data.result : [];
  if (accounts.length === 1 && accounts[0]?.id) return { accountId: String(accounts[0].id), source: 'api-single-account' };
  return { accountId: '', source: accounts.length > 1 ? 'multiple-accounts' : 'not-found', accountCount: accounts.length };
}

async function cleanupContext() {
  const token = cloudflareToken();
  const account = await resolveCloudflareAccountId(token);
  const databaseId = await wranglerDatabaseId();
  if (!account.accountId || !token || !databaseId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID or single-account CLOUDFLARE_API_TOKEN, CLOUDFLARE_API_TOKEN, and INLET_D1_DATABASE_ID or wrangler database_id are required.');
  }
  return { accountId: account.accountId, token, databaseId, accountIdSource: account.source };
}

async function d1Query(sql, params = []) {
  const { accountId, token, databaseId } = await cleanupContext();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(`Cloudflare D1 query failed: ${res.status} ${JSON.stringify(data.errors || data)}`);
  return data.result?.[0] || { results: [], meta: {} };
}

const projectLike = `${projectPrefix}%`;
const emailLike = `%@${emailDomain}`;

const targets = [
  {
    table: 'audit_logs',
    countSql: 'SELECT COUNT(*) AS count FROM audit_logs WHERE project_id LIKE ? OR actor_account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    deleteSql: 'DELETE FROM audit_logs WHERE project_id LIKE ? OR actor_account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    params: [projectLike, emailLike],
  },
  {
    table: 'ai_keys',
    countSql: 'SELECT COUNT(*) AS count FROM ai_keys WHERE project_id LIKE ? OR owner_account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    deleteSql: 'DELETE FROM ai_keys WHERE project_id LIKE ? OR owner_account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    params: [projectLike, emailLike],
  },
  {
    table: 'ai_drafts',
    countSql: 'SELECT COUNT(*) AS count FROM ai_drafts WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM ai_drafts WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'ownership_transfer_requests',
    countSql: 'SELECT COUNT(*) AS count FROM ownership_transfer_requests WHERE project_id LIKE ? OR to_account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    deleteSql: 'DELETE FROM ownership_transfer_requests WHERE project_id LIKE ? OR to_account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    params: [projectLike, emailLike],
  },
  {
    table: 'payments',
    countSql: 'SELECT COUNT(*) AS count FROM payments WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM payments WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'subscriptions',
    countSql: 'SELECT COUNT(*) AS count FROM subscriptions WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM subscriptions WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'delivery_logs',
    countSql: 'SELECT COUNT(*) AS count FROM delivery_logs WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM delivery_logs WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'events',
    countSql: 'SELECT COUNT(*) AS count FROM events WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM events WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'leads',
    countSql: 'SELECT COUNT(*) AS count FROM leads WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM leads WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'lead_blocked_submissions',
    countSql: 'SELECT COUNT(*) AS count FROM lead_blocked_submissions WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM lead_blocked_submissions WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'page_revisions',
    countSql: 'SELECT COUNT(*) AS count FROM page_revisions WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM page_revisions WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'pages',
    countSql: 'SELECT COUNT(*) AS count FROM pages WHERE project_id LIKE ?',
    deleteSql: 'DELETE FROM pages WHERE project_id LIKE ?',
    params: [projectLike],
  },
  {
    table: 'invites',
    countSql: 'SELECT COUNT(*) AS count FROM invites WHERE project_id LIKE ? OR email LIKE ?',
    deleteSql: 'DELETE FROM invites WHERE project_id LIKE ? OR email LIKE ?',
    params: [projectLike, emailLike],
  },
  {
    table: 'project_members',
    countSql: 'SELECT COUNT(*) AS count FROM project_members WHERE project_id LIKE ? OR account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    deleteSql: 'DELETE FROM project_members WHERE project_id LIKE ? OR account_id IN (SELECT id FROM accounts WHERE email LIKE ?)',
    params: [projectLike, emailLike],
  },
  {
    table: 'projects',
    countSql: 'SELECT COUNT(*) AS count FROM projects WHERE id LIKE ? OR slug LIKE ?',
    deleteSql: 'DELETE FROM projects WHERE id LIKE ? OR slug LIKE ?',
    params: [projectLike, projectLike],
  },
  {
    table: 'accounts',
    countSql: 'SELECT COUNT(*) AS count FROM accounts WHERE email LIKE ?',
    deleteSql: 'DELETE FROM accounts WHERE email LIKE ?',
    params: [emailLike],
  },
];

async function run() {
  const explicitAccountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '').trim();
  const token = cloudflareToken();
  const databaseId = await wranglerDatabaseId();
  let account = { accountId: explicitAccountId, source: explicitAccountId ? 'env' : 'missing' };
  if (token && !account.accountId) {
    account = await resolveCloudflareAccountId(token);
  }
  const missing = [
    account.accountId ? '' : 'CLOUDFLARE_ACCOUNT_ID or single-account CLOUDFLARE_API_TOKEN',
    token ? '' : 'CLOUDFLARE_API_TOKEN',
    databaseId ? '' : 'INLET_D1_DATABASE_ID or wrangler DB database_id',
  ].filter(Boolean);

  if (missing.length) {
    return {
      ok: true,
      liveSummary: { 'skipped-live': 1 },
      checks: [status('Hosted QA D1 cleanup plan', false, missing, {
        mode: 'plan-only',
        projectPrefix,
        emailDomain,
        accountIdSource: account.source,
        accountCount: account.accountCount,
      })],
    };
  }

  const plan = [];
  for (const target of targets) {
    const result = await d1Query(target.countSql, target.params);
    plan.push({ table: target.table, count: Number(result.results?.[0]?.count || 0) });
  }
  const total = plan.reduce((sum, item) => sum + item.count, 0);

  let writeResult = null;
  if (writeEnabled) {
    if (approval !== 'I_APPROVE_HOSTED_QA_CLEANUP') {
      throw new Error('Write mode requires INLET_D1_QA_CLEANUP_APPROVAL=I_APPROVE_HOSTED_QA_CLEANUP.');
    }
    const deleted = [];
    for (const target of targets) {
      const before = plan.find((item) => item.table === target.table)?.count || 0;
      await d1Query(target.deleteSql, target.params);
      deleted.push({ table: target.table, planned: before });
    }
    writeResult = { ok: true, deleted };
  }

  return {
    ok: true,
    liveSummary: summarize([{ status: 'ready' }]),
    checks: [{
      name: 'Hosted QA D1 cleanup plan',
      status: 'ready',
      mode: writeEnabled ? 'write' : 'plan-only',
      writeGuard: {
        writeRequires: 'INLET_D1_QA_CLEANUP_WRITE=1',
        approvalRequires: 'INLET_D1_QA_CLEANUP_APPROVAL=I_APPROVE_HOSTED_QA_CLEANUP',
      },
      projectPrefix,
      emailDomain,
      total,
      plan,
      writeResult,
    }],
  };
}

const result = await run().catch((error) => ({
  ok: false,
  liveSummary: { 'failed-live': 1 },
  checks: [{
    name: 'Hosted QA D1 cleanup plan',
    status: 'failed-live',
    error: error?.message || String(error),
  }],
}));

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
