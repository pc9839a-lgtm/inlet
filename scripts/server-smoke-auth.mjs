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

  const managerOwnerId = `user_${stableHash('manager@example.test')}`;
  const managerHeaders = authHeaders({
    'X-Inlet-Owner-Id': managerOwnerId,
    'X-Inlet-Project-Id': project.projectId,
  });
  await assertManagerServerAccessMatrix(baseUrl, project, managerHeaders, 'manager header identity');

  const ownerAfterManagerWrite = await fetchWithTimeout(`${baseUrl}/api/pages/${project.slug}?projectId=${project.projectId}&ownerId=${project.ownerId}`, {
    headers: authHeaders(),
  });
  const ownerAfterManagerWriteData = await ownerAfterManagerWrite.json();
  assert(ownerAfterManagerWriteData.page?.ownership?.ownerEmail !== 'hacker@example.test', 'manager page write must not overwrite ownership metadata');
});

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

  const accepted = await fetchWithTimeout(`${baseUrl}/api/projects/invites/${encodeURIComponent(inviteData.invite.token)}/accept`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: 'invite-manager@example.test', name: 'Accepted Manager' }),
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
