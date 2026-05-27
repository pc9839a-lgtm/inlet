const baseUrl = String(process.env.INLET_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
const requireHosted = process.env.INLET_HOSTED_ROUTE_QA_REQUIRE === '1';
const allowWrites = process.env.INLET_HOSTED_ROUTE_QA_WRITE === '1';

function summarize(checks = []) {
  return checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
}

function skipped(missing = []) {
  return {
    ok: true,
    liveSummary: { 'skipped-live': 1 },
    checks: [{
      name: 'Hosted API route parity',
      status: 'skipped-live',
      missing,
      manualCheck: 'Set INLET_PUBLIC_API_URL and INLET_HOSTED_ROUTE_QA_WRITE=1 to verify D1-backed /api/leads, /api/events, and read protection on hosted Pages Functions.',
    }],
  };
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { text };
  }
  return { res, data, text };
}

async function run() {
  if (!baseUrl) return skipped(['INLET_PUBLIC_API_URL']);
  if (!allowWrites) return skipped(['INLET_HOSTED_ROUTE_QA_WRITE']);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const project = {
    projectId: `hosted-route-qa-${stamp}`,
    ownerId: 'hosted-route-qa',
    slug: `hosted-route-qa-${stamp}`,
  };
  const month = new Date().toISOString().slice(0, 7);
  const checks = [];

  const lead = await jsonFetch('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      project,
      page: { slug: project.slug },
      lead: {
        id: `lead-${stamp}`,
        type: 'consult',
        kind: 'consult',
        status: 'new',
        name: 'Hosted Route QA',
        phone: '010-0000-0000',
        memo: 'hosted route write smoke',
        createdAt: new Date().toISOString(),
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/leads public write',
    status: lead.res.ok && lead.data?.lead?.id === `lead-${stamp}` ? 'ready' : 'failed-live',
    httpStatus: lead.res.status,
  });

  const event = await jsonFetch('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      project,
      page: { slug: project.slug },
      event: {
        id: `event-${stamp}`,
        type: 'page_view',
        eventType: 'page_view',
        visitorId: `visitor-${stamp}`,
        sessionId: `session-${stamp}`,
        dedupeKey: `pv-${stamp}`,
        createdAt: new Date().toISOString(),
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/events public write',
    status: event.res.ok && event.data?.event?.id === `event-${stamp}` ? 'ready' : 'failed-live',
    httpStatus: event.res.status,
  });

  const protectedLeads = await jsonFetch(`/api/leads?projectId=${encodeURIComponent(project.projectId)}&month=${month}`);
  checks.push({
    name: 'Hosted /api/leads read protection',
    status: protectedLeads.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedLeads.res.status,
  });

  const protectedStats = await jsonFetch(`/api/stats/summary?projectId=${encodeURIComponent(project.projectId)}&month=${month}`);
  checks.push({
    name: 'Hosted /api/stats/summary read protection',
    status: protectedStats.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedStats.res.status,
  });

  const protectedCsv = await fetch(`${baseUrl}/api/leads/export.csv?projectId=${encodeURIComponent(project.projectId)}&month=${month}`, {
    signal: AbortSignal.timeout(10000),
  });
  checks.push({
    name: 'Hosted /api/leads/export.csv read protection',
    status: protectedCsv.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedCsv.status,
  });

  const protectedDeliveryLogs = await jsonFetch(`/api/leads/delivery-logs?projectId=${encodeURIComponent(project.projectId)}&month=${month}`);
  checks.push({
    name: 'Hosted /api/leads/delivery-logs read protection',
    status: protectedDeliveryLogs.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedDeliveryLogs.res.status,
  });

  const protectedRetryQueue = await jsonFetch(`/api/leads/retry-queue?projectId=${encodeURIComponent(project.projectId)}`);
  checks.push({
    name: 'Hosted /api/leads/retry-queue read protection',
    status: protectedRetryQueue.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedRetryQueue.res.status,
  });

  const protectedPage = await jsonFetch(`/api/pages/${encodeURIComponent(project.slug)}?projectId=${encodeURIComponent(project.projectId)}`);
  checks.push({
    name: 'Hosted /api/pages/:slug read protection',
    status: protectedPage.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedPage.res.status,
  });

  const protectedPageWrite = await jsonFetch(`/api/pages/${encodeURIComponent(project.slug)}`, {
    method: 'POST',
    body: JSON.stringify({ project, page: { slug: project.slug, title: 'Blocked write' } }),
  });
  checks.push({
    name: 'Hosted /api/pages/:slug write protection',
    status: protectedPageWrite.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedPageWrite.res.status,
  });

  const protectedRevisions = await jsonFetch(`/api/pages/${encodeURIComponent(project.slug)}/revisions?projectId=${encodeURIComponent(project.projectId)}`);
  checks.push({
    name: 'Hosted /api/pages/:slug/revisions read protection',
    status: protectedRevisions.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedRevisions.res.status,
  });

  const authEmail = `hosted-route-qa-${stamp}@inlet.test`;
  const authPhone = `010${stamp.slice(-8)}`;
  const authPhoneNext = `011${stamp.slice(-8)}`;
  const verificationIssue = await jsonFetch('/api/auth/email-verification', {
    method: 'POST',
    body: JSON.stringify({ email: authEmail, purpose: 'signup' }),
  });
  const verificationToken = String(verificationIssue.data?.verification?.token || '').trim();
  checks.push({
    name: 'Hosted /api/auth/email-verification issue',
    status: verificationIssue.res.ok && verificationToken ? 'ready' : 'failed-live',
    httpStatus: verificationIssue.res.status,
  });

  const verificationConfirm = await jsonFetch('/api/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ email: authEmail, token: verificationToken }),
  });
  checks.push({
    name: 'Hosted /api/auth/email-verification confirm',
    status: verificationConfirm.res.ok && verificationConfirm.data?.verification?.status === 'confirmed' ? 'ready' : 'failed-live',
    httpStatus: verificationConfirm.res.status,
  });

  const register = await jsonFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      user: {
        name: 'Hosted Auth QA',
        email: authEmail,
        phone: authPhone,
        password: 'secret1',
        emailVerified: true,
        source: 'hosted-route-qa',
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/auth/register',
    status: register.res.ok && register.data?.user?.email === authEmail ? 'ready' : 'failed-live',
    httpStatus: register.res.status,
  });

  const duplicateRegister = await jsonFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      user: {
        name: 'Hosted Auth QA Duplicate',
        email: authEmail,
        phone: authPhone,
        password: 'secret1',
        emailVerified: true,
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/auth/register duplicate protection',
    status: duplicateRegister.res.status === 409 ? 'ready' : 'failed-live',
    httpStatus: duplicateRegister.res.status,
  });

  const login = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: authEmail, password: 'secret1', projectId: project.projectId }),
  });
  const session = String(login.data?.session || '').trim();
  checks.push({
    name: 'Hosted /api/auth login/session',
    status: login.res.ok && login.data?.user?.email === authEmail && session ? 'ready' : 'failed-live',
    httpStatus: login.res.status,
  });

  const sessionRefresh = await jsonFetch('/api/auth/session', {
    method: 'POST',
    headers: { 'X-Inlet-Session': session },
    body: JSON.stringify({ session, projectId: project.projectId }),
  });
  const refreshedSession = String(sessionRefresh.data?.session || session).trim();
  checks.push({
    name: 'Hosted /api/auth/session refresh',
    status: sessionRefresh.res.ok && sessionRefresh.data?.user?.email === authEmail && refreshedSession ? 'ready' : 'failed-live',
    httpStatus: sessionRefresh.res.status,
  });

  const accountPatch = await jsonFetch('/api/auth/account', {
    method: 'PATCH',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({ session: refreshedSession, name: 'Hosted Auth QA Updated', phone: authPhoneNext, projectId: project.projectId }),
  });
  checks.push({
    name: 'Hosted /api/auth/account patch',
    status: accountPatch.res.ok && accountPatch.data?.user?.phone === authPhoneNext ? 'ready' : 'failed-live',
    httpStatus: accountPatch.res.status,
  });

  const passwordChange = await jsonFetch('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ email: authEmail, password: 'secret2', emailVerified: true }),
  });
  checks.push({
    name: 'Hosted /api/auth/password verified change',
    status: passwordChange.res.ok && passwordChange.data?.user?.email === authEmail ? 'ready' : 'failed-live',
    httpStatus: passwordChange.res.status,
  });

  const logout = await jsonFetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({}),
  });
  checks.push({
    name: 'Hosted /api/auth/logout',
    status: logout.res.ok && logout.data?.loggedOut === true ? 'ready' : 'failed-live',
    httpStatus: logout.res.status,
  });

  const managerEmail = `hosted-manager-${stamp}@inlet.test`;
  const managerPhone = `012${stamp.slice(-8)}`;
  const inviteCreate = await jsonFetch('/api/projects/invites', {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      manager: {
        name: 'Hosted Manager QA',
        email: managerEmail,
        access: {
          edit: { read: true, write: true },
          inbox: { read: true, write: false },
          stats: { read: true, write: false },
        },
      },
    }),
  });
  const inviteToken = String(inviteCreate.data?.invite?.token || '').trim();
  checks.push({
    name: 'Hosted /api/projects/invites create',
    status: inviteCreate.res.ok && inviteCreate.data?.invite?.email === managerEmail && inviteToken ? 'ready' : 'failed-live',
    httpStatus: inviteCreate.res.status,
  });

  const inviteRead = await jsonFetch(`/api/projects/invites/${encodeURIComponent(inviteToken)}`);
  checks.push({
    name: 'Hosted /api/projects/invites/:token read',
    status: inviteRead.res.ok && inviteRead.data?.invite?.email === managerEmail ? 'ready' : 'failed-live',
    httpStatus: inviteRead.res.status,
  });

  const inviteAccept = await jsonFetch(`/api/projects/invites/${encodeURIComponent(inviteToken)}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      authMode: 'signup',
      name: 'Hosted Manager QA',
      email: managerEmail,
      phone: managerPhone,
      password: 'secret3',
      emailVerified: true,
    }),
  });
  checks.push({
    name: 'Hosted /api/projects/invites/:token accept',
    status: inviteAccept.res.ok && inviteAccept.data?.manager?.email === managerEmail && inviteAccept.data?.session ? 'ready' : 'failed-live',
    httpStatus: inviteAccept.res.status,
  });

  return {
    ok: checks.every((check) => check.status === 'ready') || !requireHosted,
    liveSummary: summarize(checks),
    projectId: project.projectId,
    checks,
  };
}

const result = await run();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
