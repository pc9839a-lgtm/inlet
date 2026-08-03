const baseUrl = String(process.env.INLET_ADMIN_AUDIT_BASE_URL || 'https://pagero.kr').replace(/\/+$/, '');
const phase = String(process.env.INLET_ADMIN_AUDIT_LIVE_PHASE || 'read-only').trim().toLowerCase();
const requireLive = String(process.env.INLET_ADMIN_AUDIT_LIVE_REQUIRE || '') === '1';
const allowWrites = String(process.env.INLET_ADMIN_AUDIT_LIVE_WRITE || '') === '1';
const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.INLET_ADMIN_AUDIT_TIMEOUT_MS || 12000)));
const projectSlugPrefix = String(process.env.INLET_ADMIN_AUDIT_PROJECT_SLUG_PREFIX || 'qa-audit-').trim().toLowerCase();

const secrets = {
  platformMasterSession: String(process.env.INLET_ADMIN_AUDIT_PLATFORM_MASTER_SESSION || '').trim(),
  generalSession: String(process.env.INLET_ADMIN_AUDIT_GENERAL_SESSION || '').trim(),
  generalPassword: String(process.env.INLET_ADMIN_AUDIT_GENERAL_PASSWORD || ''),
  nextEmail: String(process.env.INLET_ADMIN_AUDIT_NEXT_EMAIL || '').trim().toLowerCase(),
  emailChangeToken: String(process.env.INLET_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN || '').trim(),
  retentionSecret: String(process.env.INLET_ADMIN_AUDIT_RETENTION_SECRET || '').trim(),
};

const allowedPhases = new Set(['read-only', 'request-email-token', 'verify-live']);
const evidence = [];
let accountNeedsRestore = false;
let projectNeedsRestore = false;
let targetAccountId = '';
let targetProjectId = '';
let adminSession = '';

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function record(name, status, details = {}) {
  evidence.push({ name, status, ...details });
}

function responseCode(data = {}) {
  return String(data.code || data?.details?.code || '').trim();
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 300),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  };
}

function missingInputs() {
  const required = ['platformMasterSession', 'generalSession'];
  if (phase === 'request-email-token') required.push('nextEmail');
  if (phase === 'verify-live') {
    required.push('generalPassword', 'nextEmail', 'emailChangeToken', 'retentionSecret');
  }
  return required.filter((name) => !secrets[name]);
}

async function request(path, { session = '', method = 'GET', body, headers = {}, accept = 'application/json' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: accept,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session ? { 'X-Inlet-Session': session } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 500) };
      }
    }
    return { response, data, text };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`request timed out: ${method} ${path}`, { timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sessionSnapshot(label, session, expectedPlatformMaster) {
  const result = await request('/api/auth/session', { session });
  if (!result.response.ok) {
    fail(`${label} session refresh failed`, { status: result.response.status, code: responseCode(result.data) });
  }
  const user = result.data.user || {};
  if (!user.ownerId || !user.email) fail(`${label} session response is missing identity`);
  if (expectedPlatformMaster !== undefined && Boolean(user.platformMaster) !== expectedPlatformMaster) {
    fail(`${label} platform-master state mismatch`, {
      expected: expectedPlatformMaster,
      actual: Boolean(user.platformMaster),
    });
  }
  record(`${label}:session-refresh`, 'passed', { platformMaster: Boolean(user.platformMaster) });
  return {
    user,
    session: String(result.data.session || session),
  };
}

async function verifyAdminAccess(admin, general) {
  const forged = await request('/api/admin/audit?limit=1', {
    session: general.session,
    headers: {
      'X-Inlet-Role': 'superadmin',
      'X-Inlet-Owner-Id': general.user.ownerId,
    },
  });
  if (forged.response.status !== 403 || responseCode(forged.data) !== 'PLATFORM_MASTER_REQUIRED') {
    fail('general or forged-role session was not blocked from admin audit API', {
      status: forged.response.status,
      code: responseCode(forged.data),
    });
  }
  record('admin-api:general-and-forged-role-blocked', 'passed', { status: forged.response.status });

  const allowed = await request('/api/admin/audit?limit=1', { session: admin.session });
  if (!allowed.response.ok || !Array.isArray(allowed.data.records)) {
    fail('platform-master session could not read admin audit API', {
      status: allowed.response.status,
      code: responseCode(allowed.data),
    });
  }
  record('admin-api:platform-master-allowed', 'passed', { status: allowed.response.status });

  const consolePage = await request('/admin/audit', { accept: 'text/html' });
  const robots = String(consolePage.response.headers.get('X-Robots-Tag') || '').toLowerCase();
  const cacheControl = String(consolePage.response.headers.get('Cache-Control') || '').toLowerCase();
  const csp = String(consolePage.response.headers.get('Content-Security-Policy') || '').toLowerCase();
  if (!consolePage.response.ok || !robots.includes('noindex') || !cacheControl.includes('no-store') || !csp.includes("frame-ancestors 'none'")) {
    fail('admin audit console security headers are incomplete', {
      status: consolePage.response.status,
      noindex: robots.includes('noindex'),
      noStore: cacheControl.includes('no-store'),
      frameBlocked: csp.includes("frame-ancestors 'none'"),
    });
  }
  if (!consolePage.text.includes('/api/admin/audit') || !consolePage.text.includes('/api/admin/accounts/')) {
    fail('admin audit console is missing required operator controls');
  }
  record('admin-console:security-and-controls', 'passed');
}

async function requestEmailToken(general) {
  if (secrets.nextEmail === String(general.user.email || '').trim().toLowerCase()) {
    fail('next email must differ from the fixture account email');
  }
  const result = await request('/api/auth/email-verification', {
    method: 'POST',
    body: { email: secrets.nextEmail, purpose: 'email-change' },
  });
  if (!result.response.ok) {
    fail('email-change verification request failed', {
      status: result.response.status,
      code: responseCode(result.data),
    });
  }
  if (result.data?.verification?.token) {
    fail('production email verification response exposed a token');
  }
  if (String(result.data?.verification?.purpose || '') !== 'email-change') {
    fail('email verification response purpose mismatch');
  }
  record('email-change:verification-requested', 'passed', {
    deliveryStatus: String(result.data?.verification?.delivery?.status || ''),
  });
}

async function passwordLogin(email, password, expectedStatus = 200) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (result.response.status !== expectedStatus) {
    fail('password login status mismatch', {
      expectedStatus,
      actualStatus: result.response.status,
      code: responseCode(result.data),
    });
  }
  return result;
}

async function disposableProject(session) {
  const result = await request('/api/projects', { session });
  if (!result.response.ok || !Array.isArray(result.data.pages)) {
    fail('fixture project list failed', { status: result.response.status, code: responseCode(result.data) });
  }
  const page = result.data.pages.find((item) => String(item.slug || '').toLowerCase().startsWith(projectSlugPrefix));
  if (!page?.projectId || !page?.slug) {
    fail('no disposable project matched the required slug prefix', {
      requiredPrefix: projectSlugPrefix,
      accessiblePages: result.data.pages.length,
    });
  }
  record('fixture:disposable-project-confirmed', 'passed', { slugPrefix: projectSlugPrefix });
  return page;
}

async function publicPageStatus(slug, expectedStatus, label) {
  const result = await request(`/api/pages/${encodeURIComponent(slug)}?public=1&fresh=${Date.now()}`);
  if (result.response.status !== expectedStatus) {
    fail(`${label} public page status mismatch`, {
      expectedStatus,
      actualStatus: result.response.status,
      code: responseCode(result.data),
    });
  }
  record(label, 'passed', { status: result.response.status });
  return result;
}

async function setAccountStatus(action) {
  const result = await request(`/api/admin/accounts/${encodeURIComponent(targetAccountId)}/status`, {
    session: adminSession,
    method: 'PATCH',
    body: { action },
  });
  if (!result.response.ok || String(result.data?.account?.status || '') !== (action === 'suspend' ? 'suspended' : 'active')) {
    fail(`account ${action} failed`, { status: result.response.status, code: responseCode(result.data) });
  }
  record(`account:${action}`, 'passed', { changed: Boolean(result.data.changed) });
  return result;
}

async function setProjectStatus(action) {
  const result = await request(`/api/admin/projects/${encodeURIComponent(targetProjectId)}/status`, {
    session: adminSession,
    method: 'PATCH',
    body: { action },
  });
  const expected = action === 'pause' ? 'paused' : 'active';
  if (!result.response.ok || String(result.data?.project?.operatorState || '') !== expected) {
    fail(`project ${action} failed`, { status: result.response.status, code: responseCode(result.data) });
  }
  record(`project:${action}`, 'passed', { changed: Boolean(result.data.changed) });
  return result;
}

async function retentionDryRun() {
  const result = await request('/api/admin/audit/retention', {
    method: 'POST',
    body: { dryRun: true },
    headers: { Authorization: `Bearer ${secrets.retentionSecret}` },
  });
  if (!result.response.ok || result.data.dryRun !== true || Number(result.data.deleted || 0) !== 0) {
    fail('audit retention dry-run failed or deleted rows', {
      status: result.response.status,
      code: responseCode(result.data),
      dryRun: result.data.dryRun === true,
      deleted: Number(result.data.deleted || 0),
    });
  }
  if (Number(result.data.retentionDays || 0) < 365 || Number(result.data.batchLimit || 0) > 5000) {
    fail('audit retention limits are outside the approved bounds', {
      retentionDays: Number(result.data.retentionDays || 0),
      batchLimit: Number(result.data.batchLimit || 0),
    });
  }
  record('audit-retention:dry-run', 'passed', {
    retentionDays: Number(result.data.retentionDays || 0),
    batchLimit: Number(result.data.batchLimit || 0),
    candidates: Number(result.data.candidates || 0),
  });
}

async function verifyAuditAction(action, { dateFrom, targetType = '', targetId = '' } = {}) {
  const query = new URLSearchParams({ action, dateFrom, limit: '100' });
  if (targetType) query.set('targetType', targetType);
  const result = await request(`/api/admin/audit?${query}`, { session: adminSession });
  if (!result.response.ok || !Array.isArray(result.data.records)) {
    fail(`audit query failed for ${action}`, { status: result.response.status, code: responseCode(result.data) });
  }
  const found = result.data.records.some((record) => {
    if (record.action !== action) return false;
    if (targetType && record.targetType !== targetType) return false;
    if (targetId && record.targetId !== targetId) return false;
    return true;
  });
  if (!found) fail(`required audit action was not found: ${action}`);
  record(`audit:${action}`, 'passed');
}

async function cleanup() {
  const errors = [];
  if (accountNeedsRestore && targetAccountId && adminSession) {
    try {
      await setAccountStatus('restore');
      accountNeedsRestore = false;
    } catch (error) {
      errors.push({ operation: 'account-restore', ...safeError(error) });
    }
  }
  if (projectNeedsRestore && targetProjectId && adminSession) {
    try {
      await setProjectStatus('restore');
      projectNeedsRestore = false;
    } catch (error) {
      errors.push({ operation: 'project-restore', ...safeError(error) });
    }
  }
  if (errors.length) fail('cleanup failed', { errors });
}

async function runVerifyLive(admin, general, startedAt) {
  const currentEmail = String(general.user.email || '').trim().toLowerCase();
  if (!currentEmail || currentEmail === secrets.nextEmail) {
    fail('fixture email state does not match an email-change run');
  }

  const preflightLogin = await passwordLogin(currentEmail, secrets.generalPassword, 200);
  if (!preflightLogin.data.session) fail('fixture password login did not return a session');
  record('email-change:password-fixture-confirmed', 'passed');

  const page = await disposableProject(general.session);
  targetAccountId = general.user.ownerId;
  targetProjectId = page.projectId;
  await publicPageStatus(page.slug, 200, 'project:public-before-pause');

  const changed = await request('/api/auth/account/email', {
    session: general.session,
    method: 'PATCH',
    body: {
      email: secrets.nextEmail,
      token: secrets.emailChangeToken,
      currentPassword: secrets.generalPassword,
      projectId: page.projectId,
    },
  });
  if (!changed.response.ok || !changed.data.session || String(changed.data?.user?.email || '').toLowerCase() !== secrets.nextEmail) {
    fail('verified email change failed', { status: changed.response.status, code: responseCode(changed.data) });
  }
  const nextSession = String(changed.data.session);
  record('email-change:completed', 'passed');

  const oldSession = await request('/api/auth/session', { session: general.session });
  if (oldSession.response.ok || !['AUTH_ACCOUNT_NOT_FOUND', 'AUTH_SESSION_INVALID'].includes(responseCode(oldSession.data))) {
    fail('old email session remained usable after email change', {
      status: oldSession.response.status,
      code: responseCode(oldSession.data),
    });
  }
  record('email-change:old-session-rejected', 'passed', { status: oldSession.response.status });

  const refreshed = await sessionSnapshot('email-change:new-session', nextSession, false);

  await setAccountStatus('suspend');
  accountNeedsRestore = true;

  const suspendedSession = await request('/api/auth/session', { session: refreshed.session });
  if (suspendedSession.response.status !== 403 || responseCode(suspendedSession.data) !== 'AUTH_ACCOUNT_SUSPENDED') {
    fail('suspended account session was not rejected', {
      status: suspendedSession.response.status,
      code: responseCode(suspendedSession.data),
    });
  }
  record('account:suspended-session-rejected', 'passed');

  const suspendedLogin = await passwordLogin(secrets.nextEmail, secrets.generalPassword, 403);
  if (responseCode(suspendedLogin.data) !== 'AUTH_ACCOUNT_SUSPENDED') {
    fail('suspended account login returned the wrong error', { code: responseCode(suspendedLogin.data) });
  }
  record('account:suspended-login-rejected', 'passed');

  await setAccountStatus('restore');
  accountNeedsRestore = false;
  const restoredLogin = await passwordLogin(secrets.nextEmail, secrets.generalPassword, 200);
  const restoredSession = String(restoredLogin.data.session || '');
  if (!restoredSession) fail('restored account login did not return a session');
  record('account:restored-login-succeeded', 'passed');

  await setProjectStatus('pause');
  projectNeedsRestore = true;
  await publicPageStatus(page.slug, 404, 'project:public-blocked-while-paused');

  await setProjectStatus('restore');
  projectNeedsRestore = false;
  await publicPageStatus(page.slug, 200, 'project:public-restored');

  const restoredProjects = await request('/api/projects', { session: restoredSession });
  if (!restoredProjects.response.ok || !Array.isArray(restoredProjects.data.pages)
    || !restoredProjects.data.pages.some((item) => item.projectId === page.projectId)) {
    fail('restored project was not visible to the fixture account');
  }
  record('project:restored-owner-access', 'passed');

  await retentionDryRun();

  await verifyAuditAction('account.email_changed', {
    dateFrom: startedAt,
    targetType: 'account',
    targetId: targetAccountId,
  });
  await verifyAuditAction('account.suspended_by_admin', {
    dateFrom: startedAt,
    targetType: 'account',
    targetId: targetAccountId,
  });
  await verifyAuditAction('account.restored_by_admin', {
    dateFrom: startedAt,
    targetType: 'account',
    targetId: targetAccountId,
  });
  await verifyAuditAction('project.paused', {
    dateFrom: startedAt,
    targetType: 'project',
    targetId: targetProjectId,
  });
  await verifyAuditAction('project.restored', {
    dateFrom: startedAt,
    targetType: 'project',
    targetId: targetProjectId,
  });
  await verifyAuditAction('audit.retention_dry_run', {
    dateFrom: startedAt,
    targetType: 'audit_log',
  });
}

async function main() {
  if (!allowedPhases.has(phase)) fail('unsupported verification phase', { phase });
  if (!projectSlugPrefix || !/^qa-[a-z0-9-]+-$/.test(projectSlugPrefix)) {
    fail('disposable project slug prefix must use the qa-...- format', { projectSlugPrefix });
  }

  const missing = missingInputs();
  const writePhase = phase !== 'read-only';
  if (missing.length || (writePhase && !allowWrites)) {
    const reason = missing.length
      ? `missing required inputs: ${missing.join(', ')}`
      : 'INLET_ADMIN_AUDIT_LIVE_WRITE is not enabled';
    const output = {
      ok: !requireLive,
      status: 'skipped-live',
      phase,
      baseUrl,
      writeEnabled: allowWrites,
      missing,
      reason,
    };
    console.log(JSON.stringify(output, null, 2));
    if (requireLive) process.exitCode = 1;
    return;
  }

  const startedAt = new Date(Date.now() - 5000).toISOString();
  const admin = await sessionSnapshot('platform-master', secrets.platformMasterSession, true);
  const general = await sessionSnapshot('general-fixture', secrets.generalSession, false);
  adminSession = admin.session;
  await verifyAdminAccess(admin, general);

  if (phase === 'read-only') {
    console.log(JSON.stringify({
      ok: true,
      status: 'verified-live',
      phase,
      baseUrl,
      checks: evidence.length,
      evidence,
    }, null, 2));
    return;
  }

  if (phase === 'request-email-token') {
    await requestEmailToken(general);
    await verifyAuditAction('auth.email_verification_requested', {
      dateFrom: startedAt,
      targetType: 'email_verification',
    });
    console.log(JSON.stringify({
      ok: true,
      status: 'awaiting-email-token',
      phase,
      baseUrl,
      checks: evidence.length,
      evidence,
      nextAction: 'Store the received one-time code in PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN, then run verify-live.',
    }, null, 2));
    return;
  }

  await runVerifyLive(admin, general, startedAt);
  await cleanup();
  console.log(JSON.stringify({
    ok: true,
    status: 'verified-live',
    phase,
    baseUrl,
    checks: evidence.length,
    evidence,
    fixtureState: {
      emailChanged: true,
      accountRestored: true,
      projectRestored: true,
      retentionDryRunOnly: true,
    },
  }, null, 2));
}

try {
  await main();
} catch (error) {
  try {
    await cleanup();
  } catch (cleanupError) {
    error.cleanup = safeError(cleanupError);
  }
  console.error(JSON.stringify({
    ok: false,
    status: 'failed-live',
    phase,
    baseUrl,
    error: safeError(error),
    ...(error.cleanup ? { cleanup: error.cleanup } : {}),
    evidence,
  }, null, 2));
  process.exitCode = 1;
}
