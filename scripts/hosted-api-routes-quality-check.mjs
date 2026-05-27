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
        delivery: {
          status: 'failed',
          retry: { attempts: 1, nextRetryAt: new Date(Date.now() + 60000).toISOString() },
          logs: [{
            id: `delivery-${stamp}`,
            target: 'hosted-route-qa-webhook',
            status: 'failed',
            message: 'hosted route delivery smoke',
            idempotencyKey: `delivery-${stamp}`,
            at: new Date().toISOString(),
          }],
        },
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

  const authedLeads = await jsonFetch(`/api/leads?projectId=${encodeURIComponent(project.projectId)}&month=${month}&limit=10`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/leads authenticated D1 list',
    status: authedLeads.res.ok && authedLeads.data?.meta?.source === 'd1' && Array.isArray(authedLeads.data?.leads) && authedLeads.data.leads.some((item) => item.id === `lead-${stamp}`) ? 'ready' : 'failed-live',
    httpStatus: authedLeads.res.status,
    failureReason: authedLeads.data?.error || `leads=${Array.isArray(authedLeads.data?.leads) ? authedLeads.data.leads.length : 'not-array'}`,
  });

  const authedStats = await jsonFetch(`/api/stats/summary?projectId=${encodeURIComponent(project.projectId)}&month=${month}`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/stats/summary authenticated D1 aggregate',
    status: authedStats.res.ok && authedStats.data?.adapter === 'd1' && authedStats.data?.totals?.leads >= 1 && authedStats.data?.summary?.funnel?.pageViews >= 1 ? 'ready' : 'failed-live',
    httpStatus: authedStats.res.status,
    failureReason: authedStats.data?.error || JSON.stringify({ totals: authedStats.data?.totals, funnel: authedStats.data?.summary?.funnel }),
  });

  const authedCsv = await fetch(`${baseUrl}/api/leads/export.csv?projectId=${encodeURIComponent(project.projectId)}&month=${month}`, {
    headers: { 'X-Inlet-Session': refreshedSession },
    signal: AbortSignal.timeout(10000),
  });
  const authedCsvText = await authedCsv.text();
  checks.push({
    name: 'Hosted /api/leads/export.csv authenticated D1 month export',
    status: authedCsv.ok && authedCsvText.includes('Hosted Route QA') && authedCsv.headers.get('content-type')?.includes('text/csv') ? 'ready' : 'failed-live',
    httpStatus: authedCsv.status,
    failureReason: authedCsvText.slice(0, 160),
  });

  const authedDeliveryLogs = await jsonFetch(`/api/leads/delivery-logs?projectId=${encodeURIComponent(project.projectId)}&month=${month}&leadId=${encodeURIComponent(`lead-${stamp}`)}`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/leads/delivery-logs authenticated D1 list',
    status: authedDeliveryLogs.res.ok && authedDeliveryLogs.data?.queryPlan?.adapter === 'd1' && Array.isArray(authedDeliveryLogs.data?.logs) && authedDeliveryLogs.data.logs.some((item) => item.idempotencyKey === `delivery-${stamp}`) ? 'ready' : 'failed-live',
    httpStatus: authedDeliveryLogs.res.status,
    failureReason: authedDeliveryLogs.data?.error || `logs=${Array.isArray(authedDeliveryLogs.data?.logs) ? authedDeliveryLogs.data.logs.length : 'not-array'}`,
  });

  const authedRetryQueue = await jsonFetch(`/api/leads/retry-queue?projectId=${encodeURIComponent(project.projectId)}&status=failed`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/leads/retry-queue authenticated D1 list',
    status: authedRetryQueue.res.ok && authedRetryQueue.data?.queryPlan?.adapter === 'd1' && authedRetryQueue.data?.retryable >= 1 && Array.isArray(authedRetryQueue.data?.entries) && authedRetryQueue.data.entries.some((item) => item.leadId === `lead-${stamp}`) ? 'ready' : 'failed-live',
    httpStatus: authedRetryQueue.res.status,
    failureReason: authedRetryQueue.data?.error || JSON.stringify({ retryable: authedRetryQueue.data?.retryable, count: authedRetryQueue.data?.count }),
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

  const aiKeyMissing = await jsonFetch(`/api/ai/key?projectId=${encodeURIComponent(project.projectId)}&ownerId=${encodeURIComponent(accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '')}`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/ai/key missing status',
    status: aiKeyMissing.res.ok && aiKeyMissing.data?.key?.status === 'missing' ? 'ready' : 'failed-live',
    httpStatus: aiKeyMissing.res.status,
    failureReason: aiKeyMissing.data?.error || aiKeyMissing.data?.key?.status || '',
  });

  const aiKeyInvalid = await jsonFetch('/api/ai/key', {
    method: 'PUT',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      projectId: project.projectId,
      ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '',
      apiKey: 'bad-key',
    }),
  });
  checks.push({
    name: 'Hosted /api/ai/key invalid protection',
    status: aiKeyInvalid.res.status === 400 ? 'ready' : 'failed-live',
    httpStatus: aiKeyInvalid.res.status,
    failureReason: aiKeyInvalid.data?.error || aiKeyInvalid.text?.slice?.(0, 160) || '',
  });

  const aiKeySave = await jsonFetch('/api/ai/key', {
    method: 'PUT',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      projectId: project.projectId,
      ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '',
      apiKey: `sk-hosted-route-qa-${stamp}-abcdef`,
    }),
  });
  checks.push({
    name: 'Hosted /api/ai/key save',
    status: aiKeySave.res.ok && aiKeySave.data?.key?.connected === true && aiKeySave.data?.key?.maskedKey?.endsWith('cdef') && !JSON.stringify(aiKeySave.data).includes(`sk-hosted-route-qa-${stamp}`) ? 'ready' : 'failed-live',
    httpStatus: aiKeySave.res.status,
  });

  const aiKeyTestInvalid = await jsonFetch('/api/ai/test', {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      apiKey: 'bad-key',
      model: 'gpt-4.1',
    }),
  });
  checks.push({
    name: 'Hosted /api/ai/test invalid key classification',
    status: aiKeyTestInvalid.res.status === 400 && aiKeyTestInvalid.data?.keyTest?.status === 'invalid' ? 'ready' : 'failed-live',
    httpStatus: aiKeyTestInvalid.res.status,
    failureReason: aiKeyTestInvalid.data?.error || aiKeyTestInvalid.text?.slice?.(0, 160) || '',
  });

  const aiDraftSave = await jsonFetch('/api/ai/drafts', {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      draft: {
        id: `ai-draft-${stamp}`,
        pageTitle: 'Hosted AI Draft QA',
        blocks: [{ type: 'hero', title: 'Hosted AI', body: 'editable draft smoke' }],
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/ai/drafts save',
    status: aiDraftSave.res.ok && aiDraftSave.data?.draft?.id === `ai-draft-${stamp}` ? 'ready' : 'failed-live',
    httpStatus: aiDraftSave.res.status,
    failureReason: aiDraftSave.data?.error || aiDraftSave.text?.slice?.(0, 160) || '',
  });

  const aiDraftList = await jsonFetch(`/api/ai/drafts?projectId=${encodeURIComponent(project.projectId)}&ownerId=${encodeURIComponent(accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '')}`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/ai/drafts list',
    status: aiDraftList.res.ok && Array.isArray(aiDraftList.data?.drafts) && aiDraftList.data.drafts.some((item) => item.id === `ai-draft-${stamp}`) ? 'ready' : 'failed-live',
    httpStatus: aiDraftList.res.status,
    failureReason: aiDraftList.data?.error || `drafts=${Array.isArray(aiDraftList.data?.drafts) ? aiDraftList.data.drafts.length : 'not-array'}`,
  });

  const aiDraftDelete = await jsonFetch(`/api/ai/drafts/${encodeURIComponent(`ai-draft-${stamp}`)}?projectId=${encodeURIComponent(project.projectId)}&ownerId=${encodeURIComponent(accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '')}`, {
    method: 'DELETE',
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/ai/drafts delete',
    status: aiDraftDelete.res.ok && aiDraftDelete.data?.id === `ai-draft-${stamp}` ? 'ready' : 'failed-live',
    httpStatus: aiDraftDelete.res.status,
    failureReason: aiDraftDelete.data?.error || aiDraftDelete.text?.slice?.(0, 160) || '',
  });

  const aiKeyDelete = await jsonFetch(`/api/ai/key?projectId=${encodeURIComponent(project.projectId)}&ownerId=${encodeURIComponent(accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '')}`, {
    method: 'DELETE',
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/ai/key delete',
    status: aiKeyDelete.res.ok && aiKeyDelete.data?.key?.status === 'missing' ? 'ready' : 'failed-live',
    httpStatus: aiKeyDelete.res.status,
  });

  const transferCreate = await jsonFetch('/api/projects/ownership-transfer', {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      transfer: {
        managerEmail,
        managerName: 'Hosted Manager QA',
        note: 'hosted ownership transfer smoke',
      },
    }),
  });
  const transferId = String(transferCreate.data?.request?.id || '').trim();
  checks.push({
    name: 'Hosted /api/projects/ownership-transfer create',
    status: transferCreate.res.ok && transferCreate.data?.request?.managerEmail === managerEmail && transferId ? 'ready' : 'failed-live',
    httpStatus: transferCreate.res.status,
  });

  const transferList = await jsonFetch(`/api/projects/ownership-transfer?projectId=${encodeURIComponent(project.projectId)}`, {
    headers: { 'X-Inlet-Session': refreshedSession },
  });
  checks.push({
    name: 'Hosted /api/projects/ownership-transfer list',
    status: transferList.res.ok && Array.isArray(transferList.data?.requests) && transferList.data.requests.some((item) => item.id === transferId) ? 'ready' : 'failed-live',
    httpStatus: transferList.res.status,
  });

  const transferWaiting = await jsonFetch(`/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      status: 'waiting_billing_clearance',
      billingClearanceStatus: 'active_subscription',
      note: 'billing active',
    }),
  });
  checks.push({
    name: 'Hosted /api/admin/ownership-transfer billing wait',
    status: transferWaiting.res.ok && transferWaiting.data?.request?.status === 'waiting_billing_clearance' ? 'ready' : 'failed-live',
    httpStatus: transferWaiting.res.status,
  });

  const transferBlocked = await jsonFetch(`/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      status: 'completed',
      billingClearanceStatus: 'active_subscription',
    }),
  });
  checks.push({
    name: 'Hosted /api/admin/ownership-transfer billing block',
    status: transferBlocked.res.status === 409 ? 'ready' : 'failed-live',
    httpStatus: transferBlocked.res.status,
  });

  const transferCompleted = await jsonFetch(`/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'POST',
    headers: { 'X-Inlet-Session': refreshedSession },
    body: JSON.stringify({
      project: { ...project, ownerId: accountPatch.data?.user?.ownerId || login.data?.user?.ownerId || '' },
      status: 'completed',
      billingClearanceStatus: 'clear',
    }),
  });
  checks.push({
    name: 'Hosted /api/admin/ownership-transfer complete',
    status: transferCompleted.res.ok && transferCompleted.data?.request?.status === 'completed' ? 'ready' : 'failed-live',
    httpStatus: transferCompleted.res.status,
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
