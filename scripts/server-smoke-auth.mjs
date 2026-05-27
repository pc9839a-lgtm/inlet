import { assert, authHeaders, fetchWithTimeout, runSmoke } from './lib/serverSmokeHarness.mjs';
import { createHmac } from 'node:crypto';

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function signedSession(payload = {}, secret = 'smoke-session-secret') {
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

async function expectStatus(label, expected, request) {
  const response = await request();
  assert(response.status === expected, `${label} expected ${expected}, got ${response.status}`);
  return response;
}

async function assertManagerServerAccessMatrix(baseUrl, project, headers, label = 'manager') {
  await expectStatus(`${label} edit read`, 200, () => fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers,
  }));

  await expectStatus(`${label} edit write`, 200, () => fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      page: { slug: project.slug, title: `${label} Edited Page`, blocks: [], ownership: { ownerEmail: 'hacker@example.test' } },
    }),
  }));

  await expectStatus(`${label} inbox read denied`, 403, () => fetchWithTimeout(`${baseUrl}/api/leads?projectId=${project.projectId}&ownerId=${project.ownerId}&slug=${project.slug}&limit=1`, {
    headers,
  }));

  await expectStatus(`${label} inbox write denied`, 403, () => fetchWithTimeout(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      page: { slug: project.slug },
      lead: { name: 'Denied Lead', phone: '010-0000-0000' },
    }),
  }));

  await expectStatus(`${label} stats read`, 200, () => fetchWithTimeout(`${baseUrl}/api/stats/summary?projectId=${project.projectId}&ownerId=${project.ownerId}&slug=${project.slug}&month=2026-05&period=thisMonth`, {
    headers,
  }));

  await expectStatus(`${label} stats write denied`, 403, () => fetchWithTimeout(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      event: { type: 'cta', ts: '2026-05-26T00:00:00.000Z' },
    }),
  }));

  await expectStatus(`${label} invite create denied`, 403, () => fetchWithTimeout(`${baseUrl}/api/projects/invites`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      manager: { name: 'Nested Manager', email: 'nested-manager@example.test' },
    }),
  }));
}

await runSmoke('server-smoke-auth', async ({ baseUrl }) => {
  const health = await fetchWithTimeout(`${baseUrl}/api/health`);
  assert(health.status === 200, `health expected 200, got ${health.status}`);
  const healthData = await health.json();
  assert(healthData.storage?.requested === 'jsonl', 'default storage should request jsonl');
  assert(healthData.storage?.active === 'jsonl', 'default storage should stay on jsonl');
  assert(healthData.storage?.d1Ready === false, 'default Node smoke should not report D1 ready');

  const favicon = await fetchWithTimeout(`${baseUrl}/favicon.ico`);
  assert(favicon.status === 204, `favicon expected 204, got ${favicon.status}`);

  const unauthorized = await fetchWithTimeout(`${baseUrl}/api/leads?projectId=smoke-auth&slug=smoke&limit=1`);
  assert(unauthorized.status === 401, `api token guard expected 401, got ${unauthorized.status}`);

  const forbidden = await fetchWithTimeout(`${baseUrl}/api/leads?projectId=smoke-auth&slug=smoke&limit=1`, {
    headers: { Authorization: 'Bearer wrong-token' },
  });
  assert(forbidden.status === 403, `api token guard expected 403 for wrong token, got ${forbidden.status}`);

  const missingPreviewUrl = await fetchWithTimeout(`${baseUrl}/api/link-preview`, { headers: authHeaders() });
  assert(missingPreviewUrl.status === 400, `link preview missing url expected 400, got ${missingPreviewUrl.status}`);

  const privatePreviewUrl = await fetchWithTimeout(`${baseUrl}/api/link-preview?url=${encodeURIComponent('http://127.0.0.1/')}`, { headers: authHeaders() });
  assert(privatePreviewUrl.status === 400, `link preview private url expected 400, got ${privatePreviewUrl.status}`);

  const account = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Billing User', email: 'billing@example.test', phone: '010-1000-2000', password: 'secret1', emailVerified: true } }),
  });
  assert(account.status === 200, `account register expected 200, got ${account.status}`);
  const accountData = await account.json();
  assert(accountData.user?.email === 'billing@example.test' && accountData.user?.phone === '01010002000', 'account register should normalize email and phone');

  const duplicateEmail = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Duplicate Email', email: 'billing@example.test', phone: '010-1000-2001', password: 'secret1', emailVerified: true } }),
  });
  assert(duplicateEmail.status === 409, `duplicate account email expected 409, got ${duplicateEmail.status}`);

  const duplicatePhone = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Duplicate Phone', email: 'billing-phone@example.test', phone: '01010002000', password: 'secret1', emailVerified: true } }),
  });
  assert(duplicatePhone.status === 409, `duplicate account phone expected 409, got ${duplicatePhone.status}`);

  const weakPassword = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Weak Password', email: 'weak@example.test', phone: '010-1000-2002', password: '123456', emailVerified: true } }),
  });
  assert(weakPassword.status === 400, `weak password register expected 400, got ${weakPassword.status}`);

  const unverifiedSignup = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Unverified Signup', email: 'unverified@example.test', phone: '010-1000-2003', password: 'secret1', emailVerified: false } }),
  });
  assert(unverifiedSignup.status === 403, `unverified signup expected 403, got ${unverifiedSignup.status}`);

  const verificationIssue = await fetchWithTimeout(`${baseUrl}/api/auth/email-verification`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'verified-signup@example.test', purpose: 'signup' }),
  });
  assert(verificationIssue.status === 200, `email verification issue expected 200, got ${verificationIssue.status}`);
  const verificationIssueData = await verificationIssue.json();
  assert(verificationIssueData.verification?.token, 'email verification issue should expose mock token for offline QA');

  const verificationConfirm = await fetchWithTimeout(`${baseUrl}/api/auth/email-verification/confirm`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'verified-signup@example.test', token: verificationIssueData.verification.token }),
  });
  assert(verificationConfirm.status === 200, `email verification confirm expected 200, got ${verificationConfirm.status}`);

  const verifiedSignup = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Verified Signup', email: 'verified-signup@example.test', phone: '010-1000-2004', password: 'secret1' } }),
  });
  assert(verifiedSignup.status === 200, `verified signup expected 200, got ${verifiedSignup.status}`);

  const passwordNoVerify = await fetchWithTimeout(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'billing@example.test', password: 'changed1', emailVerified: false }),
  });
  assert(passwordNoVerify.status === 403, `password change without email verification expected 403, got ${passwordNoVerify.status}`);

  const passwordChanged = await fetchWithTimeout(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'billing@example.test', password: 'changed1', emailVerified: true }),
  });
  assert(passwordChanged.status === 200, `password change after email verification expected 200, got ${passwordChanged.status}`);

  const loginInvalid = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'billing@example.test', password: 'wrong1' }),
  });
  assert(loginInvalid.status === 401, `account login invalid password expected 401, got ${loginInvalid.status}`);

  const loginOk = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'billing@example.test', password: 'changed1', projectId: 'smoke-auth-project' }),
  });
  assert(loginOk.status === 200, `account login expected 200, got ${loginOk.status}`);
  const loginOkData = await loginOk.json();
  assert(loginOkData.user?.email === 'billing@example.test', 'account login should return normalized account');
  assert(Object.prototype.hasOwnProperty.call(loginOkData, 'session'), 'account login should return a session field');

  const accountUpdated = await fetchWithTimeout(`${baseUrl}/api/auth/account`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': loginOkData.session }),
    body: JSON.stringify({ name: 'Billing Owner', phone: '010-9999-0000' }),
  });
  assert(accountUpdated.status === 200, `account profile update expected 200, got ${accountUpdated.status}`);
  const accountUpdatedData = await accountUpdated.json();
  assert(accountUpdatedData.user?.name === 'Billing Owner', 'account profile update should persist name');
  assert(accountUpdatedData.user?.phone === '01099990000', 'account profile update should normalize phone');
  assert(accountUpdatedData.session, 'account profile update should return a refreshed session');

  const accountDuplicatePhone = await fetchWithTimeout(`${baseUrl}/api/auth/account`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': accountUpdatedData.session }),
    body: JSON.stringify({ name: 'Billing Owner', phone: '010-1000-2004' }),
  });
  assert(accountDuplicatePhone.status === 409, `account duplicate phone update expected 409, got ${accountDuplicatePhone.status}`);

  const statusAccount = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Status User', email: 'status-user@example.test', phone: '010-1234-5678', password: 'secret1', emailVerified: true } }),
  });
  assert(statusAccount.status === 200, `status account register expected 200, got ${statusAccount.status}`);

  const statusLogin = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'status-user@example.test', password: 'secret1', projectId: 'status-project' }),
  });
  assert(statusLogin.status === 200, `status account login expected 200, got ${statusLogin.status}`);
  const statusLoginData = await statusLogin.json();

  const statusDeleted = await fetchWithTimeout(`${baseUrl}/api/auth/account/status`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': statusLoginData.session }),
    body: JSON.stringify({ status: 'deleted' }),
  });
  assert(statusDeleted.status === 200, `account soft delete expected 200, got ${statusDeleted.status}`);
  const statusDeletedData = await statusDeleted.json();
  assert(statusDeletedData.user?.status === 'deleted', 'account soft delete should keep record with deleted status');

  const deletedLogin = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'status-user@example.test', password: 'secret1', projectId: 'status-project' }),
  });
  assert(deletedLogin.status === 403, `deleted account login expected 403, got ${deletedLogin.status}`);

  const deletedRefresh = await fetchWithTimeout(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': statusLoginData.session }),
    body: JSON.stringify({ projectId: 'status-project' }),
  });
  assert(deletedRefresh.status === 403, `deleted account session refresh expected 403, got ${deletedRefresh.status}`);

  const deletedDuplicateEmail = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Deleted Duplicate', email: 'status-user@example.test', phone: '010-1234-5679', password: 'secret1', emailVerified: true } }),
  });
  assert(deletedDuplicateEmail.status === 409, `soft-deleted account duplicate email expected 409, got ${deletedDuplicateEmail.status}`);

  const project = { projectId: 'smoke-auth-project', ownerId: 'local-user', slug: 'smoke-auth-page' };
  const saved = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      project,
      page: {
        slug: project.slug,
        title: 'Auth Smoke Page',
        blocks: [],
        ownership: {
          ownerEmail: 'owner@example.test',
          clientEmail: 'client@example.test',
          clientAccess: true,
          managers: [
            {
              id: 'manager-editor',
              name: 'Editor Manager',
              email: 'manager@example.test',
              status: 'active',
              access: {
                edit: { read: true, write: true },
                style: { read: true, write: false },
                inbox: { read: false, write: false },
                stats: { read: true, write: false },
                settings: { read: false, write: false },
              },
            },
          ],
        },
      },
    }),
  });
  assert(saved.status === 200, `project owner save expected 200, got ${saved.status}`);

  const noOwnerHeader = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders({ 'X-Inlet-Owner-Id': '' }),
  });
  assert(noOwnerHeader.status === 403, `project access without owner header expected 403, got ${noOwnerHeader.status}`);

  const wrongOwner = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders({ 'X-Inlet-Owner-Id': 'other-user' }),
  });
  assert(wrongOwner.status === 403, `project access for wrong owner expected 403, got ${wrongOwner.status}`);

  const ownerRead = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders(),
  });
  assert(ownerRead.status === 200, `project access for owner expected 200, got ${ownerRead.status}`);

  const clientOwnerId = `user_${stableHash('client@example.test')}`;
  const clientRead = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders({
      'X-Inlet-Owner-Id': clientOwnerId,
      'X-Inlet-Project-Id': project.projectId,
    }),
  });
  assert(clientRead.status === 200, `project access for transferred client expected 200, got ${clientRead.status}`);

  const clientOtherProject = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders({
      'X-Inlet-Owner-Id': clientOwnerId,
      'X-Inlet-Project-Id': 'other-project',
    }),
  });
  assert(clientOtherProject.status === 403, `client project id mismatch expected 403, got ${clientOtherProject.status}`);

  const clientManagerInvite = await fetchWithTimeout(`${baseUrl}/api/projects/invites`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'X-Inlet-Owner-Id': clientOwnerId,
      'X-Inlet-Project-Id': project.projectId,
    }),
    body: JSON.stringify({
      project,
      manager: {
        name: 'Client Invited Manager',
        email: 'client-invited-manager@example.test',
        access: {
          inbox: { read: true, write: false },
          stats: { read: true, write: false },
        },
      },
    }),
  });
  assert(clientManagerInvite.status === 200, `client admin manager invite expected 200, got ${clientManagerInvite.status}`);
  const clientManagerInviteData = await clientManagerInvite.json();
  assert(clientManagerInviteData.invite?.token, 'client admin manager invite should include token');

  const clientTransfer = await fetchWithTimeout(`${baseUrl}/api/projects/ownership-transfer`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'X-Inlet-Owner-Id': clientOwnerId,
      'X-Inlet-Project-Id': project.projectId,
    }),
    body: JSON.stringify({
      project,
      transfer: { managerEmail: 'manager@example.test' },
    }),
  });
  assert(clientTransfer.status === 200, `client admin ownership transfer request expected 200, got ${clientTransfer.status}`);
  const clientTransferData = await clientTransfer.json();
  assert(clientTransferData.request?.status === 'requested', 'ownership transfer request should stay requested before internal approval');

  const transferList = await fetchWithTimeout(`${baseUrl}/api/projects/ownership-transfer?projectId=${project.projectId}&ownerId=${project.ownerId}&slug=${project.slug}`, {
    headers: authHeaders({
      'X-Inlet-Owner-Id': clientOwnerId,
      'X-Inlet-Project-Id': project.projectId,
    }),
  });
  assert(transferList.status === 200, `ownership transfer list expected 200, got ${transferList.status}`);
  const transferListData = await transferList.json();
  assert(transferListData.requests?.length === 1, 'ownership transfer list should include created request');
  const transferId = transferListData.requests[0].id;

  const clientTransferApproval = await fetchWithTimeout(`${baseUrl}/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'PATCH',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'X-Inlet-Owner-Id': clientOwnerId,
      'X-Inlet-Project-Id': project.projectId,
    }),
    body: JSON.stringify({
      project,
      status: 'approved',
    }),
  });
  assert(clientTransferApproval.status === 403, `client ownership transfer approval expected 403, got ${clientTransferApproval.status}`);

  const ownerTransferApproval = await fetchWithTimeout(`${baseUrl}/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      project,
      status: 'waiting_billing_clearance',
      billingClearanceStatus: 'active_subscription',
      note: 'billing must clear before completion',
    }),
  });
  assert(ownerTransferApproval.status === 200, `owner ownership transfer approval expected 200, got ${ownerTransferApproval.status}`);
  const ownerTransferApprovalData = await ownerTransferApproval.json();
  assert(ownerTransferApprovalData.request?.status === 'waiting_billing_clearance', 'ownership transfer approval should preserve billing wait state');

  const managerOwnerId = `user_${stableHash('manager@example.test')}`;
  const managerHeaders = authHeaders({
    'X-Inlet-Owner-Id': managerOwnerId,
    'X-Inlet-Project-Id': project.projectId,
  });
  await assertManagerServerAccessMatrix(baseUrl, project, managerHeaders, 'manager header identity');

  const managerTransfer = await fetchWithTimeout(`${baseUrl}/api/projects/ownership-transfer`, {
    method: 'POST',
    headers: { ...managerHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      transfer: { managerEmail: 'manager@example.test' },
    }),
  });
  assert(managerTransfer.status === 403, `manager ownership transfer request expected 403, got ${managerTransfer.status}`);

  const ownerTransferCompleteBlocked = await fetchWithTimeout(`${baseUrl}/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      project,
      status: 'completed',
      billingClearanceStatus: 'active_subscription',
      note: 'should not complete while billing is active',
    }),
  });
  assert(ownerTransferCompleteBlocked.status === 409, `ownership transfer completion before billing clear expected 409, got ${ownerTransferCompleteBlocked.status}`);

  const ownerTransferComplete = await fetchWithTimeout(`${baseUrl}/api/admin/ownership-transfer/${encodeURIComponent(transferId)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      project,
      status: 'completed',
      billingClearanceStatus: 'clear',
      note: 'billing clear and transfer complete',
    }),
  });
  assert(ownerTransferComplete.status === 200, `ownership transfer completion expected 200, got ${ownerTransferComplete.status}`);
  const ownerTransferCompleteData = await ownerTransferComplete.json();
  assert(ownerTransferCompleteData.request?.status === 'completed', 'ownership transfer should reach completed state');

  const oldOwnerAfterTransfer = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders(),
  });
  assert(oldOwnerAfterTransfer.status === 403, `old owner read after ownership transfer expected 403, got ${oldOwnerAfterTransfer.status}`);

  const newOwnerAfterTransfer = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: managerHeaders,
  });
  assert(newOwnerAfterTransfer.status === 200, `new owner read after ownership transfer expected 200, got ${newOwnerAfterTransfer.status}`);
  const newOwnerAfterTransferData = await newOwnerAfterTransfer.json();
  assert(newOwnerAfterTransferData.page?.ownership?.ownerEmail === 'manager@example.test', 'completed transfer should update page owner email');
  assert(newOwnerAfterTransferData.page?.ownership?.ownerEmail !== 'hacker@example.test', 'manager page write must not overwrite ownership metadata');
}, { env: { INLET_SESSION_SECRET: 'smoke-session-secret' } });

await runSmoke('server-smoke-manager-invite-session', async ({ baseUrl }) => {
  const secret = 'smoke-session-secret';
  const project = { projectId: 'smoke-invite-project', ownerId: 'local-user', slug: 'smoke-invite-page' };
  const ownerSession = signedSession({ ownerId: project.ownerId, projectId: project.projectId, role: 'master', email: 'owner@example.test' }, secret);
  const ownerHeaders = authHeaders({
    'Content-Type': 'application/json',
    'X-Inlet-Owner-Id': 'forged-owner-ignored',
    'X-Inlet-Project-Id': 'forged-project-ignored',
    'X-Inlet-Session': ownerSession,
  });

  const saved = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      project,
      page: {
        slug: project.slug,
        title: 'Invite Smoke Page',
        blocks: [],
        ownership: {
          ownerEmail: 'owner@example.test',
          managers: [],
        },
      },
    }),
  });
  assert(saved.status === 200, `strict owner session page save expected 200, got ${saved.status}`);

  const inviteRes = await fetchWithTimeout(`${baseUrl}/api/projects/invites`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      project,
      manager: {
        name: 'Invite Manager',
        email: 'invite-manager@example.test',
        access: {
          edit: { read: true, write: true },
          inbox: { read: false, write: false },
          stats: { read: true, write: false },
        },
      },
    }),
  });
  assert(inviteRes.status === 200, `manager invite create expected 200, got ${inviteRes.status}`);
  const inviteData = await inviteRes.json();
  assert(inviteData.invite?.token, 'manager invite response should include token');

  const inviteRead = await fetchWithTimeout(`${baseUrl}/api/projects/invites/${encodeURIComponent(inviteData.invite.token)}`, {
    headers: authHeaders(),
  });
  assert(inviteRead.status === 200, `manager invite read expected 200, got ${inviteRead.status}`);

  const managerAccount = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Invite Manager', email: 'invite-manager@example.test', phone: '010-2222-3333', password: 'secret1', emailVerified: true } }),
  });
  assert(managerAccount.status === 200, `manager invite login account register expected 200, got ${managerAccount.status}`);

  const badPasswordAccept = await fetchWithTimeout(`${baseUrl}/api/projects/invites/${encodeURIComponent(inviteData.invite.token)}/accept`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'invite-manager@example.test', name: 'Accepted Manager', authMode: 'login', password: 'wrong1' }),
  });
  assert(badPasswordAccept.status === 401, `manager invite login wrong password expected 401, got ${badPasswordAccept.status}`);

  const accepted = await fetchWithTimeout(`${baseUrl}/api/projects/invites/${encodeURIComponent(inviteData.invite.token)}/accept`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'invite-manager@example.test', name: 'Accepted Manager', authMode: 'login', password: 'secret1' }),
  });
  assert(accepted.status === 200, `manager invite accept expected 200, got ${accepted.status}`);
  const acceptedData = await accepted.json();
  assert(acceptedData.session, 'accepted manager should receive signed session when session secret is configured');
  assert(acceptedData.manager?.email === 'invite-manager@example.test', 'accepted manager email mismatch');

  const signupInviteRes = await fetchWithTimeout(`${baseUrl}/api/projects/invites`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      project,
      manager: {
        name: 'Signup Manager',
        email: 'signup-manager@example.test',
        access: { stats: { read: true, write: false } },
      },
    }),
  });
  assert(signupInviteRes.status === 200, `signup manager invite create expected 200, got ${signupInviteRes.status}`);
  const signupInviteData = await signupInviteRes.json();

  const signupMissingPhone = await fetchWithTimeout(`${baseUrl}/api/projects/invites/${encodeURIComponent(signupInviteData.invite.token)}/accept`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'signup-manager@example.test', name: 'Signup Manager', authMode: 'signup', emailVerified: true, password: 'secret1' }),
  });
  assert(signupMissingPhone.status === 400, `signup invite without phone expected 400, got ${signupMissingPhone.status}`);

  const signupAccepted = await fetchWithTimeout(`${baseUrl}/api/projects/invites/${encodeURIComponent(signupInviteData.invite.token)}/accept`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'signup-manager@example.test', name: 'Signup Manager', phone: '010-3333-4444', authMode: 'signup', emailVerified: true, password: 'secret1' }),
  });
  assert(signupAccepted.status === 200, `signup manager invite accept expected 200, got ${signupAccepted.status}`);

  const managerSessionHeaders = authHeaders({
    'X-Inlet-Owner-Id': 'wrong-owner',
    'X-Inlet-Project-Id': 'wrong-project',
    'X-Inlet-Session': acceptedData.session,
  });
  await assertManagerServerAccessMatrix(baseUrl, project, managerSessionHeaders, 'accepted manager session');
}, {
  env: {
    INLET_SESSION_AUTH_MODE: 'strict',
    INLET_SESSION_SECRET: 'smoke-session-secret',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-auth-session-refresh', async ({ baseUrl }) => {
  const registered = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user: { name: 'Session User', email: 'session-user@example.test', phone: '010-7777-8888', password: 'secret1', emailVerified: true } }),
  });
  assert(registered.status === 200, `session user register expected 200, got ${registered.status}`);

  const login = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'session-user@example.test', password: 'secret1', projectId: 'session-project' }),
  });
  assert(login.status === 200, `session login expected 200, got ${login.status}`);
  const loginData = await login.json();
  assert(loginData.session, 'session login should return signed session when secret is configured');

  const refreshed = await fetchWithTimeout(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': loginData.session }),
    body: JSON.stringify({ projectId: 'session-project-next' }),
  });
  assert(refreshed.status === 200, `session refresh expected 200, got ${refreshed.status}`);
  const refreshedData = await refreshed.json();
  assert(refreshedData.user?.email === 'session-user@example.test', 'session refresh should return account user');
  assert(refreshedData.session, 'session refresh should return refreshed signed session');

  const logout = await fetchWithTimeout(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': refreshedData.session }),
    body: JSON.stringify({}),
  });
  assert(logout.status === 200, `session logout expected 200, got ${logout.status}`);

  const invalidRefresh = await fetchWithTimeout(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': 'invalid.session' }),
    body: JSON.stringify({}),
  });
  assert(invalidRefresh.status === 401, `invalid session refresh expected 401, got ${invalidRefresh.status}`);
}, {
  env: {
    INLET_SESSION_SECRET: 'smoke-session-secret',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-auth-email-delivery-smtp-skip', async ({ baseUrl }) => {
  const health = await fetchWithTimeout(`${baseUrl}/api/health`);
  assert(health.status === 200, `SMTP auth email health expected 200, got ${health.status}`);
  const healthData = await health.json();
  assert(healthData.auth?.emailDeliveryMode === 'smtp', 'SMTP auth email smoke should expose smtp mode');
  assert(healthData.auth?.emailDeliveryReady === false, 'SMTP auth email smoke should expose missing SMTP config');

  const issue = await fetchWithTimeout(`${baseUrl}/api/auth/email-verification`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'smtp-skip@example.test', purpose: 'password-reset' }),
  });
  assert(issue.status === 200, `SMTP auth email issue expected 200, got ${issue.status}`);
  const issueData = await issue.json();
  assert(issueData.verification?.delivery?.mode === 'smtp', 'SMTP auth email issue should report smtp delivery mode');
  assert(issueData.verification?.delivery?.status === 'skipped', 'SMTP auth email issue should skip without SMTP config');
  assert(!issueData.verification?.token, 'SMTP auth email issue must not expose token by default');
}, {
  env: {
    INLET_AUTH_EMAIL_MODE: 'smtp',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-strict-session-missing-secret', async ({ baseUrl }) => {
  const project = { projectId: 'smoke-strict-no-secret', ownerId: 'local-user', slug: 'smoke-strict-no-secret' };
  const forgedHeaders = authHeaders({
    'Content-Type': 'application/json',
    'X-Inlet-Owner-Id': project.ownerId,
    'X-Inlet-Project-Id': project.projectId,
  });

  const saveAttempt = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: forgedHeaders,
    body: JSON.stringify({
      project,
      page: { slug: project.slug, title: 'Strict No Secret', blocks: [] },
    }),
  });
  assert(saveAttempt.status === 403, `strict mode without session secret should reject dev headers, got ${saveAttempt.status}`);
}, {
  env: {
    INLET_SESSION_AUTH_MODE: 'strict',
    INLET_SESSION_SECRET: '',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-strict-invalid-session', async ({ baseUrl }) => {
  const secret = 'smoke-session-secret';
  const project = { projectId: 'smoke-strict-invalid-session', ownerId: 'local-user', slug: 'smoke-strict-invalid-session' };
  const validSession = signedSession({ ownerId: project.ownerId, projectId: project.projectId, role: 'master' }, secret);
  const invalidSession = `${validSession.slice(0, -4)}nope`;

  const saveAttempt = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'X-Inlet-Owner-Id': project.ownerId,
      'X-Inlet-Project-Id': project.projectId,
      'X-Inlet-Session': invalidSession,
    }),
    body: JSON.stringify({
      project,
      page: { slug: project.slug, title: 'Strict Invalid Session', blocks: [] },
    }),
  });
  assert(saveAttempt.status === 403, `strict mode with invalid session should reject forged dev headers, got ${saveAttempt.status}`);
}, {
  env: {
    INLET_SESSION_AUTH_MODE: 'strict',
    INLET_SESSION_SECRET: 'smoke-session-secret',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-production-session-alias', async ({ baseUrl }) => {
  const project = { projectId: 'smoke-production-session', ownerId: 'local-user', slug: 'smoke-production-session' };
  const health = await fetchWithTimeout(`${baseUrl}/api/health`);
  assert(health.status === 200, `production alias health expected 200, got ${health.status}`);
  const healthData = await health.json();
  assert(healthData.auth?.sessionMode === 'strict', 'production session mode should normalize to strict');
  assert(healthData.auth?.sourceOfTruth === 'signed-session', 'production session mode should use signed session as source of truth');
  assert(healthData.auth?.devHeadersAccepted === false, 'production session mode must not accept dev headers');

  const forgedHeaders = authHeaders({
    'Content-Type': 'application/json',
    'X-Inlet-Owner-Id': project.ownerId,
    'X-Inlet-Project-Id': project.projectId,
  });
  const saveAttempt = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: forgedHeaders,
    body: JSON.stringify({
      project,
      page: { slug: project.slug, title: 'Production Alias', blocks: [] },
    }),
  });
  assert(saveAttempt.status === 403, `production alias should reject dev headers, got ${saveAttempt.status}`);
}, {
  env: {
    INLET_SESSION_AUTH_MODE: 'production',
    INLET_SESSION_SECRET: 'smoke-session-secret',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-hosted-session-mode', async ({ baseUrl }) => {
  const project = { projectId: 'smoke-hosted-session', ownerId: 'local-user', slug: 'smoke-hosted-session' };
  const health = await fetchWithTimeout(`${baseUrl}/api/health`);
  assert(health.status === 200, `hosted mode health expected 200, got ${health.status}`);
  const healthData = await health.json();
  assert(healthData.auth?.sessionMode === 'hosted', 'hosted session mode should stay hosted');
  assert(healthData.auth?.sourceOfTruth === 'hosted-auth-unimplemented', 'hosted mode should expose hosted auth as unimplemented');
  assert(healthData.auth?.hostedAuthImplemented === false, 'hosted mode must not report implemented auth before provider integration exists');
  assert(healthData.auth?.devHeadersAccepted === false, 'hosted session mode must not accept dev headers');

  const forgedHeaders = authHeaders({
    'Content-Type': 'application/json',
    'X-Inlet-Owner-Id': project.ownerId,
    'X-Inlet-Project-Id': project.projectId,
  });
  const saveAttempt = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}`, {
    method: 'POST',
    headers: forgedHeaders,
    body: JSON.stringify({
      project,
      page: { slug: project.slug, title: 'Hosted Mode', blocks: [] },
    }),
  });
  assert(saveAttempt.status === 403, `hosted mode should reject dev headers, got ${saveAttempt.status}`);
}, {
  env: {
    INLET_SESSION_AUTH_MODE: 'hosted',
    INLET_SESSION_SECRET: 'smoke-session-secret',
  },
  timeoutMs: 10000,
});

await runSmoke('server-smoke-d1-storage-fallback', async ({ baseUrl }) => {
  const health = await fetchWithTimeout(`${baseUrl}/api/health`);
  assert(health.status === 200, `D1 fallback health expected 200, got ${health.status}`);
  const healthData = await health.json();
  assert(healthData.storage?.requested === 'd1', 'D1 fallback smoke should request d1');
  assert(healthData.storage?.active === 'jsonl', 'D1 fallback smoke should stay on jsonl without binding');
  assert(healthData.storage?.fallback === true, 'D1 fallback smoke should expose fallback=true');
  assert(healthData.storage?.d1Ready === false, 'D1 fallback smoke should expose d1Ready=false');

  const project = { projectId: 'smoke-d1-fallback', ownerId: 'local-user', slug: 'smoke-d1-fallback' };
  const res = await fetchWithTimeout(`${baseUrl}/api/leads?projectId=${project.projectId}&ownerId=${project.ownerId}&slug=${project.slug}&month=2026-05&limit=1`, {
    headers: authHeaders(),
  });
  assert(res.status === 200, `D1 fallback lead list expected 200, got ${res.status}`);
  const data = await res.json();
  assert(data.queryPlan?.adapter === 'd1', 'D1 fallback query plan should report requested adapter d1');
  assert(data.queryPlan?.available === false, 'D1 fallback query plan should expose unavailable binding');
  assert(data.queryPlan?.fallbackAdapter === 'jsonl', 'D1 fallback query plan should point to jsonl fallback');
}, {
  env: {
    INLET_STORAGE_ADAPTER: 'd1',
  },
  timeoutMs: 10000,
});
