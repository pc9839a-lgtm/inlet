import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const baseUrl = new URL(required('CALLTAG_STAGING_BASE_URL'));
const allowCustomHost = String(process.env.CALLTAG_STAGING_ALLOW_CUSTOM_HOST || '') === 'CALLTAG_STAGING_CUSTOM_HOST_CONFIRMED';
const deniedHosts = new Set([
  'pagero.kr',
  'www.pagero.kr',
  'calltag.pagero.kr',
  'inlet.pages.dev',
]);
const host = baseUrl.hostname.toLowerCase();
const obviousStagingHost = host.includes('staging')
  || host.endsWith('.pages.dev')
  || host === 'localhost'
  || host === '127.0.0.1';

if (!['https:', 'http:'].includes(baseUrl.protocol)) {
  throw new Error('CALLTAG_STAGING_BASE_URL must use http or https');
}
if (deniedHosts.has(host)) {
  throw new Error(`Production host is blocked: ${host}`);
}
if (!obviousStagingHost && !allowCustomHost) {
  throw new Error('Staging host is not explicit. Set CALLTAG_STAGING_ALLOW_CUSTOM_HOST=CALLTAG_STAGING_CUSTOM_HOST_CONFIRMED only for a dedicated non-production host.');
}
if (baseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(host)) {
  throw new Error('Remote staging must use HTTPS');
}

const accountA = {
  email: required('CALLTAG_STAGING_ACCOUNT_A_EMAIL'),
  password: required('CALLTAG_STAGING_ACCOUNT_A_PASSWORD'),
};
const accountB = {
  email: required('CALLTAG_STAGING_ACCOUNT_B_EMAIL'),
  password: required('CALLTAG_STAGING_ACCOUNT_B_PASSWORD'),
};
assert.notEqual(accountA.email.toLowerCase(), accountB.email.toLowerCase(), 'Two distinct staging accounts are required');

const runId = `${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const entityId = `staging-isolation-${runId}`;
const device = (owner, purpose) => `calltag-staging-${owner}-${purpose}-${runId}`;
const markerA = `owner-a-${runId}`;
const markerB = `owner-b-${runId}`;

function endpoint(pathname) {
  return new URL(pathname.replace(/^\//, ''), `${baseUrl.toString().replace(/\/$/, '')}/`).toString();
}

async function requestJson(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.session) headers.set('X-Inlet-Session', options.session);
  if (options.device) {
    headers.set('X-CallTag-Device', options.device);
    headers.set('X-CallTag-Device-Label', options.deviceLabel || 'Staging smoke');
    headers.set('X-CallTag-App-Version', 'staging-smoke/1');
  }
  let body;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  const response = await fetch(endpoint(pathname), {
    method: options.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(Number(options.timeoutMs || 20_000)),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${options.method || 'GET'} ${pathname} returned non-JSON status ${response.status}`);
  }
  if (!response.ok || payload?.ok === false) {
    const code = payload?.details?.code || payload?.code || 'UNKNOWN';
    throw new Error(`${options.method || 'GET'} ${pathname} failed (${response.status}/${code}): ${payload?.error || 'unknown error'}`);
  }
  return payload;
}

async function login(account) {
  const result = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { email: account.email, password: account.password },
  });
  const session = String(result.session || '').trim();
  const ownerId = String(result.user?.ownerId || result.user?.id || '').trim();
  assert.ok(session, 'Login response must contain a session');
  assert.ok(ownerId, 'Login response must contain an owner ID');
  return { session, ownerId };
}

function syncHeaders(auth, deviceId, label) {
  return { session: auth.session, device: deviceId, deviceLabel: label };
}

async function push(auth, deviceId, marker, deleted = false, version = 1) {
  return requestJson('/api/calltag-sync/push', {
    ...syncHeaders(auth, deviceId, `Staging ${marker}`),
    method: 'POST',
    body: {
      items: [{
        entityType: 'customer',
        entityId,
        version,
        deleted,
        payload: deleted ? {} : {
          displayName: marker,
          primaryPhone: marker === markerA ? '01090001001' : '01090002002',
          relationStatus: 'staging-smoke',
          source: 'staging-smoke',
          memo: `synthetic:${marker}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }],
    },
  });
}

function findItem(payload, id = entityId) {
  return (Array.isArray(payload?.items) ? payload.items : []).find((item) => item.entityId === id) || null;
}

async function pull(auth, deviceId) {
  return requestJson('/api/calltag-sync/pull?cursor=0&limit=100', {
    ...syncHeaders(auth, deviceId, 'Staging pull'),
  });
}

async function bootstrap(auth, deviceId) {
  return requestJson('/api/calltag-sync/bootstrap?limit=100', {
    ...syncHeaders(auth, deviceId, 'Staging recovery'),
  });
}

let authA;
let authB;
let pushedA = false;
let pushedB = false;
let primaryError = null;

try {
  [authA, authB] = await Promise.all([login(accountA), login(accountB)]);
  assert.notEqual(authA.ownerId, authB.ownerId, 'Staging accounts resolved to the same owner');

  const aPrimary = device('a', 'primary');
  const bPrimary = device('b', 'primary');
  const aRecovery = device('a', 'recovery');
  const bRecovery = device('b', 'recovery');

  await Promise.all([
    requestJson('/api/calltag-sync/status', { ...syncHeaders(authA, aPrimary, 'A primary') }),
    requestJson('/api/calltag-sync/status', { ...syncHeaders(authB, bPrimary, 'B primary') }),
  ]);

  const aPush = await push(authA, aPrimary, markerA);
  pushedA = true;
  assert.equal(aPush.accepted?.length, 1, 'Account A push must be accepted');
  assert.equal(aPush.conflicts?.length, 0, 'Account A push must have no conflict');

  const bPush = await push(authB, bPrimary, markerB);
  pushedB = true;
  assert.equal(bPush.accepted?.length, 1, 'Account B push must be accepted');
  assert.equal(bPush.conflicts?.length, 0, 'Account B push must have no conflict');

  const [aPull, bPull] = await Promise.all([
    pull(authA, aPrimary),
    pull(authB, bPrimary),
  ]);
  const aPulledItem = findItem(aPull);
  const bPulledItem = findItem(bPull);
  assert.equal(aPulledItem?.payload?.displayName, markerA, 'Account A must read only its payload');
  assert.equal(bPulledItem?.payload?.displayName, markerB, 'Account B must read only its payload');
  assert.notEqual(aPulledItem?.payload?.displayName, markerB, 'Account A leaked account B payload');
  assert.notEqual(bPulledItem?.payload?.displayName, markerA, 'Account B leaked account A payload');

  const [aBootstrap, bBootstrap] = await Promise.all([
    bootstrap(authA, aRecovery),
    bootstrap(authB, bRecovery),
  ]);
  assert.equal(findItem(aBootstrap)?.payload?.displayName, markerA, 'Account A reinstall bootstrap failed');
  assert.equal(findItem(bBootstrap)?.payload?.displayName, markerB, 'Account B reinstall bootstrap failed');
  assert.equal(aBootstrap.complete, true, 'Account A bootstrap must complete in one page for smoke data');
  assert.equal(bBootstrap.complete, true, 'Account B bootstrap must complete in one page for smoke data');

  const [aDevices, bDevices] = await Promise.all([
    requestJson('/api/calltag-sync/devices', { ...syncHeaders(authA, aRecovery, 'A recovery') }),
    requestJson('/api/calltag-sync/devices', { ...syncHeaders(authB, bRecovery, 'B recovery') }),
  ]);
  assert.ok(aDevices.devices?.some((item) => item.current && item.active), 'Account A current recovery device missing');
  assert.ok(bDevices.devices?.some((item) => item.current && item.active), 'Account B current recovery device missing');
  assert.ok((aDevices.devices || []).every((item) => !String(item.label || '').includes('Staging owner-b')), 'Account A device list leaked account B');
  assert.ok((bDevices.devices || []).every((item) => !String(item.label || '').includes('Staging owner-a')), 'Account B device list leaked account A');

  await push(authA, aPrimary, markerA, true, 2);
  pushedA = false;
  const [aAfterDelete, bAfterADelete] = await Promise.all([
    pull(authA, aPrimary),
    pull(authB, bPrimary),
  ]);
  const aDeleted = findItem(aAfterDelete);
  const bStillActive = findItem(bAfterADelete);
  assert.equal(aDeleted?.deleted, true, 'Account A tombstone was not returned');
  assert.equal(aDeleted?.payload, null, 'Account A tombstone must not expose payload');
  assert.equal(bStillActive?.deleted, false, 'Account A deletion affected account B');
  assert.equal(bStillActive?.payload?.displayName, markerB, 'Account B payload changed after account A deletion');

  await push(authB, bPrimary, markerB, true, 2);
  pushedB = false;

  console.log(JSON.stringify({
    ok: true,
    scope: 'calltag-secure-sync-staging',
    runId,
    ownersDistinct: true,
    sameEntityIdIsolated: true,
    reinstallBootstrapVerified: true,
    tombstoneIsolationVerified: true,
    cleanup: 'tombstones-written',
  }, null, 2));
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const cleanup = [];
  if (pushedA && authA) cleanup.push(push(authA, device('a', 'cleanup'), markerA, true, 2));
  if (pushedB && authB) cleanup.push(push(authB, device('b', 'cleanup'), markerB, true, 2));
  if (cleanup.length) {
    const results = await Promise.allSettled(cleanup);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length && !primaryError) {
      throw new Error(`Staging cleanup failed for ${failed.length} account(s)`);
    }
    if (failed.length) {
      console.error(`Staging cleanup also failed for ${failed.length} account(s)`);
    }
  }
}
