import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { onRequest as pageLimitMiddleware } from '../functions/api/pages/_middleware.js';
import { isPlatformMasterIdentity } from '../functions/api/_platformMaster.js';
import { canCreateLandingPage, isPlatformMasterUser } from '../src/lib/platformAccountPolicy.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = process.cwd();
const read = (path) => readFile(`${root}/${path}`, 'utf8');

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function sessionToken({ ownerId = 'user-general', email = 'user@example.com', role = 'master' } = {}, secret = 'qa-secret') {
  const payloadPart = base64Url(JSON.stringify({
    ownerId,
    projectId: '',
    role,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadPart));
  return `${payloadPart}.${Buffer.from(signature).toString('base64url')}`;
}

function fakeDb({ count = 0, ownedTarget = false } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('SELECT pages.id')) return ownedTarget ? { id: 'page-existing' } : null;
              if (sql.includes('COUNT(DISTINCT projects.id)')) return { count };
              throw new Error(`Unexpected account limit query: ${sql}`);
            },
          };
        },
      };
    },
  };
}

async function invoke({ email, role = 'master', count = 0, ownedTarget = false, configuredMasters = '' } = {}) {
  const secret = 'qa-secret';
  const token = await sessionToken({ email, role, ownerId: `owner-${email}` }, secret);
  const body = {
    saveMode: 'create-new',
    identity: {
      mode: 'create-new',
      pageId: ownedTarget ? 'page-existing' : '',
      projectId: ownedTarget ? 'project-existing' : 'project-new',
      ownerId: `owner-${email}`,
      slug: 'second-page',
    },
    page: {
      id: ownedTarget ? 'page-existing' : '',
      projectId: ownedTarget ? 'project-existing' : 'project-new',
      ownerId: `owner-${email}`,
      slug: 'second-page',
      title: 'Second page',
    },
  };
  const request = new Request('https://example.test/api/pages/second-page', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Inlet-Session': token,
    },
    body: JSON.stringify(body),
  });
  let nextCalls = 0;
  const response = await pageLimitMiddleware({
    request,
    env: {
      DB: fakeDb({ count, ownedTarget }),
      INLET_SESSION_SECRET: secret,
      INLET_PLATFORM_MASTER_EMAILS: configuredMasters,
    },
    next: async () => {
      nextCalls += 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  return { response, nextCalls };
}

assert.equal(isPlatformMasterIdentity({ email: 'pc9839a@naver.com' }), true);
assert.equal(isPlatformMasterIdentity({ email: 'extra@pagero.kr' }, { INLET_PLATFORM_MASTER_EMAILS: 'extra@pagero.kr' }), true);
assert.equal(isPlatformMasterIdentity({ email: 'user@example.com', role: 'superadmin' }), false, 'role input must not grant platform-master quota bypass');
assert.equal(isPlatformMasterUser({ email: 'pc9839a@naver.com' }), true);
assert.equal(canCreateLandingPage({ email: 'user@example.com' }, 0), true);
assert.equal(canCreateLandingPage({ email: 'user@example.com' }, 1), false);
assert.equal(canCreateLandingPage({ email: 'pc9839a@naver.com' }, 999), true);

const blocked = await invoke({ email: 'user@example.com', count: 1 });
assert.equal(blocked.response.status, 409);
assert.equal(blocked.nextCalls, 0);
assert.equal((await blocked.response.json()).code, 'ACCOUNT_PAGE_LIMIT_REACHED');

const firstPage = await invoke({ email: 'first@example.com', count: 0 });
assert.equal(firstPage.response.status, 200);
assert.equal(firstPage.nextCalls, 1);

const operator = await invoke({ email: 'pc9839a@naver.com', count: 20 });
assert.equal(operator.response.status, 200);
assert.equal(operator.nextCalls, 1);

const configuredOperator = await invoke({ email: 'extra@pagero.kr', count: 20, configuredMasters: 'extra@pagero.kr' });
assert.equal(configuredOperator.response.status, 200);
assert.equal(configuredOperator.nextCalls, 1);

const forgedRole = await invoke({ email: 'forged@example.com', role: 'superadmin', count: 1 });
assert.equal(forgedRole.response.status, 409);
assert.equal(forgedRole.nextCalls, 0);

const replay = await invoke({ email: 'user@example.com', count: 1, ownedTarget: true });
assert.equal(replay.response.status, 200);
assert.equal(replay.nextCalls, 1);

const [middlewareSource, dashboardSource, loginSource, sessionSource] = await Promise.all([
  read('functions/api/pages/_middleware.js'),
  read('src/screens/DashboardScreen.jsx'),
  read('functions/api/auth/login.js'),
  read('functions/api/auth/session.js'),
]);

assert.match(middlewareSource, /COUNT\(DISTINCT projects\.id\)/);
assert.match(middlewareSource, /NOT IN \('archived', 'deleted'\)/);
assert.match(middlewareSource, /ACCOUNT_PAGE_LIMIT_REACHED/);
assert.match(middlewareSource, /ownedTargetExists/);
assert.match(dashboardSource, /canCreateLandingPage/);
assert.match(dashboardSource, /disabled=\{createDisabled\}/);
assert.match(dashboardSource, /show=\{createOpen && !createDisabled\}/);
assert.match(dashboardSource, /일반 계정은 랜딩페이지를 1개까지만 만들 수 있습니다/);
assert.match(loginSource, /role: 'master'/);
assert.match(loginSource, /withPlatformMaster/);
assert.match(sessionSource, /withPlatformMaster/);

console.log(JSON.stringify({
  ok: true,
  policy: 'general-account-one-page-platform-master-unlimited',
  cases: 6,
}, null, 2));
