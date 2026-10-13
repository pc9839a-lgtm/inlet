import { randomUUID } from 'node:crypto';
import { assert, authHeaders, delay, fetchWithTimeout, withServer } from './lib/serverSmokeHarness.mjs';
import { sameCommittedPageContent, isCommittedSaveRetryConflict } from '../src/runtime/pageSaveReplayRecovery.js';
import { clearPageDraft, readPageDraft, savePageDraft } from '../src/runtime/pageDraftStore.js';

// ED-R11: real local HTTP API + temporary JSONL disk + signed sessions.
// No mocked /api/pages responses. No writes to a live or shared environment.
const runtimeResult = { signedLogin: false, readback: false, slowNetwork: false, concurrentTabs: false, staleWriteRejected: false, reconnection: false, failedBeforeSendPreserved: false, lostAckRecovered: false, duplicateRevisionBlocked: false, divergentChangesProtected: false, iterations: 0 };

async function api(baseUrl, method, endpoint, body, session = '', timeoutMs = 8000) {
  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method,
    headers: authHeaders({
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { 'X-Inlet-Session': session } : {}),
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, timeoutMs);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Invalid JSON response (${res.status}) for ${method} ${endpoint}`); }
  return { status: res.status, data };
}

await withServer(async ({ baseUrl, dataDir }) => {
  assert(dataDir.includes('.tmp-smoke'), 'test must only run against isolated temporary storage');
  const id = randomUUID().replace(/-/g, '').slice(0, 13);
  const email = `ed-r11-${id}@example.test`;
  const projectId = `ed-r11-project-${id}`;
  const slug = `ed-r11-${id}`;
  const password = 'testPassword123!';
  const issue = await api(baseUrl, 'POST', '/api/auth/email-verification', { email, purpose: 'signup' });
  assert(issue.status === 200 && /^[0-9]{6}$/.test(issue.data.verification?.token || ''), 'mock email verification must issue an isolated code');
  const confirm = await api(baseUrl, 'POST', '/api/auth/email-verification/confirm', { email, token: issue.data.verification.token });
  assert(confirm.status === 200, 'local test email verification must succeed');
  const registration = await api(baseUrl, 'POST', '/api/auth/register', {
    projectId,
    user: { name: 'ED-R11 Test', email, phone: '010-9999-0987', password },
  });
  assert(registration.status === 200 && registration.data.session, 'register must issue a signed session');

  const login = await api(baseUrl, 'POST', '/api/auth/login', { email, password, projectId });
  assert(login.status === 200 && login.data.session, 'account must log in using the actual auth endpoint');
  const sessionA = login.data.session;
  const secondLogin = await api(baseUrl, 'POST', '/api/auth/login', { email, password, projectId });
  assert(secondLogin.status === 200 && secondLogin.data.session, 'independent second editor client must log in');
  const sessionB = secondLogin.data.session;
  const ownerId = String(login.data.user?.ownerId || registration.data.user?.ownerId || '');
  assert(ownerId, 'signed account owner identity is required');
  runtimeResult.signedLogin = true;

  const project = { projectId, ownerId, slug };
  const endpoint = `/api/pages/${slug}`;
  const readEndpoint = `${endpoint}?${new URLSearchParams(project)}`;
  const initialPage = {
    id: `page-${id}`, slug, projectId, ownerId, title: 'ED-R11 initial',
    theme: { accent: '#263A5D' },
    blocks: [{ id: 'hero', type: 'hero', visible: true, s: { title: 'start', body: 'Local-only test page' } }],
  };
  const created = await api(baseUrl, 'POST', endpoint, { project, page: initialPage }, sessionA);
  assert(created.status === 200 && created.data.page?.id, `initial save failed: ${created.status} ${created.data.error || ''}`);
  let authoritative = created.data.page;
  const readA = await api(baseUrl, 'GET', readEndpoint, null, sessionA);
  const readB = await api(baseUrl, 'GET', readEndpoint, null, sessionB);
  assert(readA.status === 200 && readB.status === 200, 'both authenticated clients must read the same page');
  assert(readA.data.page.id === readB.data.page.id, 'two tabs must select one identical persisted page');
  runtimeResult.readback = true;

  // Simulated slow client uplink with a real server (not a fabricated response).
  // Client B retains an old read while A performs a successful write.
  const delayedStaleRequest = (async () => {
    await delay(230);
    return api(baseUrl, 'POST', endpoint, {
      project,
      expectedUpdatedAt: readB.data.page.updatedAt,
      page: { ...readB.data.page, title: 'REJECT stale delayed B' },
    }, sessionB);
  })();

  await delay(35);
  const aWrite = await api(baseUrl, 'POST', endpoint, {
    project,
    expectedUpdatedAt: readA.data.page.updatedAt,
    page: { ...readA.data.page, title: 'A won first write', blocks: readA.data.page.blocks.map(b => ({ ...b, s: { ...b.s, title: 'A latest hero' } })) },
  }, sessionA);
  assert(aWrite.status === 200 && aWrite.data.page?.title === 'A won first write', 'A must publish before B delayed request');
  const staleB = await delayedStaleRequest;
  assert(staleB.status === 409 && staleB.data.code === 'PAGE_REVISION_CONFLICT', `stale B write must fail with a version conflict; got ${staleB.status}: ${staleB.data.code || ''}`);
  const verifyAfterStale = await api(baseUrl, 'GET', readEndpoint, null, sessionA);
  assert(verifyAfterStale.data.page?.title === 'A won first write', 'stale delayed B request must not overwrite A');
  runtimeResult.slowNetwork = true;
  runtimeResult.staleWriteRejected = true;
  authoritative = verifyAfterStale.data.page;

  // Simulate an editor left open through repeated edits and multiple revisions.
  // Each network save is followed by a server readback; no in-memory-only success.
  for (let step = 1; step <= 16; step += 1) {
    await delay(12);
    const updatedTitle = `ED-R11 editing step ${step}`;
    const payload = { project, expectedUpdatedAt: authoritative.updatedAt, page: {
      ...authoritative, title: updatedTitle,
      blocks: authoritative.blocks.map(block => block.id === 'hero'
        ? { ...block, s: { ...block.s, title: `hero-step-${step}` } }
        : block),
    } };
    const written = await api(baseUrl, 'POST', endpoint, payload, sessionA);
    assert(written.status === 200 && written.data.page.title === updatedTitle, `long editing write ${step} failed: ${written.status}: ${written.data.error || ''}`);
    const reopened = await api(baseUrl, 'GET', readEndpoint, null, sessionB);
    assert(reopened.status === 200 && reopened.data.page?.title === updatedTitle, `readback missing latest edit ${step}`);
    assert(reopened.data.page.blocks?.[0]?.s?.title === `hero-step-${step}`, `block content lost at ${step}`);
    authoritative = reopened.data.page;
    runtimeResult.iterations += 1;
  }

  // B refreshes after A's sustained editing; then B publishes a fresh write.
  await delay(15);
  const bCurrent = await api(baseUrl, 'GET', readEndpoint, null, sessionB);
  assert(bCurrent.status === 200, 'B must be able to reload the current version');
  const bSaved = await api(baseUrl, 'POST', endpoint, {
    project,
    expectedUpdatedAt: bCurrent.data.page.updatedAt,
    page: { ...bCurrent.data.page, title: 'B after refresh' },
  }, sessionB);
  assert(bSaved.status === 200 && bSaved.data.page.title === 'B after refresh', 'B updated version must be accepted');
  const oldA = await api(baseUrl, 'POST', endpoint, {
    project,
    expectedUpdatedAt: authoritative.updatedAt,
    page: { ...authoritative, title: 'REJECT old A revision' },
  }, sessionA);
  assert(oldA.status === 409 && oldA.data.code === 'PAGE_REVISION_CONFLICT', 'A stale version must not overwrite B');
  runtimeResult.concurrentTabs = true;

  // Actual re-login and fresh API read (separate from any cached page state).
  const freshLogin = await api(baseUrl, 'POST', '/api/auth/login', { email, password, projectId });
  assert(freshLogin.status === 200 && freshLogin.data.session, 'after editing, user must be able to re-login');
  const fromFreshSession = await api(baseUrl, 'GET', readEndpoint, null, freshLogin.data.session);
  assert(fromFreshSession.status === 200 && fromFreshSession.data.page?.title === 'B after refresh', 'fresh login must load B newest committed page');
  const publicRead = await api(baseUrl, 'GET', `${endpoint}?public=1&fresh=${Date.now()}`);
  assert(publicRead.status === 200 && publicRead.data.page?.title === 'B after refresh', 'published page must reflect newest authenticated save');

  // ED-R12: disconnected before request transmission cannot mutate the server.
  // Persist a real page-draft-store copy, then restore and publish after link return.
  const entries = new Map();
  const isolatedStorage = {
    getItem: (key) => entries.has(key) ? entries.get(key) : null,
    setItem: (key, value) => { entries.set(key, String(value)); },
    removeItem: (key) => { entries.delete(key); },
    key: (index) => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
  };
  const offlineBase = fromFreshSession.data.page;
  const offlinePage = { ...offlineBase, title: 'ED-R12 offline draft, then reconnected',
    blocks: offlineBase.blocks.map(block => block.id === 'hero'
      ? { ...block, s: { ...block.s, title: 'ED-R12 offline hero survives' } }
      : block) };
  const offlineDraft = savePageDraft({ page: offlinePage, authUser: login.data.user,
    storage: isolatedStorage, sourceId: 'disconnected-editor' });
  assert(offlineDraft?.page?.title === offlinePage.title, 'disconnected edit must remain in isolated draft storage');

  const aborted = new AbortController();
  aborted.abort();
  let offlineRejected = false;
  try {
    await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST', signal: aborted.signal,
      headers: authHeaders({ 'Content-Type': 'application/json', 'X-Inlet-Session': sessionA }),
      body: JSON.stringify({ project, expectedUpdatedAt: offlineBase.updatedAt, page: offlinePage }),
    });
  } catch (error) {
    offlineRejected = error?.name === 'AbortError';
  }
  assert(offlineRejected, 'disconnected request must be rejected before reaching HTTP server');
  const afterOffline = await api(baseUrl, 'GET', readEndpoint, null, sessionB);
  assert(afterOffline.status === 200 && afterOffline.data.page.title === 'B after refresh',
    'offline request must not mutate authoritative page');
  assert(readPageDraft({ page: offlineBase, authUser: login.data.user, storage: isolatedStorage, sourceId: 'disconnected-editor' })?.page?.title === offlinePage.title,
    'offline draft must survive transport failure');
  runtimeResult.failedBeforeSendPreserved = true;

  const reconnectedWrite = await api(baseUrl, 'POST', endpoint, {
    project, expectedUpdatedAt: afterOffline.data.page.updatedAt, page: offlinePage,
  }, sessionA);
  assert(reconnectedWrite.status === 200 && reconnectedWrite.data.page?.title === offlinePage.title,
    'offline draft must be published after network reconnection');
  const reconnectRead = await api(baseUrl, 'GET', readEndpoint, null, sessionB);
  assert(reconnectRead.data.page?.blocks?.[0]?.s?.title === 'ED-R12 offline hero survives',
    'reconnected full page read must preserve offline edited block content');
  assert(clearPageDraft({ page: offlineBase, authUser: login.data.user, storage: isolatedStorage, sourceId: 'disconnected-editor' }),
    'successfully published offline draft must be clearable');
  assert(!readPageDraft({ page: offlineBase, authUser: login.data.user, storage: isolatedStorage, sourceId: 'disconnected-editor' }),
    'successfully published offline draft must no longer be offered for recovery');

  // First HTTP request reaches the real server and commits. The simulated
  // client loses ONLY its acknowledgement and resends the identical stale
  // write. Recovery must read the authoritative server result and prove
  // identical content, not mark the second 409 as a second successful write.
  const beforeDroppedAck = reconnectRead.data.page;
  const lostAckPage = { ...beforeDroppedAck, title: 'ED-R12 committed response lost',
    blocks: beforeDroppedAck.blocks.map(block => block.id === 'hero'
      ? { ...block, s: { ...block.s, title: 'ED-R12 exactly once hero' } }
      : block) };
  const lostAckPayload = { project, expectedUpdatedAt: beforeDroppedAck.updatedAt, page: lostAckPage };
  let simulatedLostAck = false;
  try {
    const accepted = await api(baseUrl, 'POST', endpoint, lostAckPayload, sessionA);
    assert(accepted.status === 200, 'first request must be committed before response loss is injected');
    // The transport hands no success result to the editor even though the
    // database write has finished; this throws in the simulated client.
    throw new TypeError('ED_R12_RESPONSE_DROPPED_AFTER_COMMIT');
  } catch (error) {
    simulatedLostAck = error?.message === 'ED_R12_RESPONSE_DROPPED_AFTER_COMMIT';
  }
  assert(simulatedLostAck, 'test must simulate a lost acknowledgement after the actual write');
  const replay = await api(baseUrl, 'POST', endpoint, lostAckPayload, sessionA);
  assert(replay.status === 409 && replay.data?.code === 'PAGE_REVISION_CONFLICT',
    'replayed stale request after committed response loss must return 409');
  assert(isCommittedSaveRetryConflict({ status: replay.status, details: replay.data }),
    '409 replay must be recognized as a possible already committed save');
  const serverAfterReplay = await api(baseUrl, 'GET', readEndpoint, null, sessionB);
  assert(serverAfterReplay.status === 200 && serverAfterReplay.data.page?.title === lostAckPage.title,
    'retry cannot lose committed content');
  assert(Number(serverAfterReplay.data.page.revision) === Number(beforeDroppedAck.revision) + 1,
    'lost acknowledgement and retry must produce exactly one server revision');
  assert(sameCommittedPageContent(serverAfterReplay.data.page, lostAckPage),
    'already committed content must be proven byte-equivalent after normalizing version fields');
  runtimeResult.lostAckRecovered = true;
  runtimeResult.duplicateRevisionBlocked = true;

  // If another editor truly changed the server after the uncertain write,
  // the first editor cannot falsely claim that its attempted content won.
  const distinctServerPage = {
    ...serverAfterReplay.data.page, title: 'ED-R12 another editor superseded the uncertain write',
  };
  const distinctWrite = await api(baseUrl, 'POST', endpoint, {
    project, expectedUpdatedAt: serverAfterReplay.data.page.updatedAt, page: distinctServerPage,
  }, sessionB);
  assert(distinctWrite.status === 200, 'second editor must be able to publish a newer divergent version');
  const ambiguousRetry = await api(baseUrl, 'POST', endpoint, lostAckPayload, sessionA);
  assert(ambiguousRetry.status === 409 && ambiguousRetry.data?.code === 'PAGE_REVISION_CONFLICT',
    'stale original editor cannot overwrite divergent content after response loss');
  const finalRead = await api(baseUrl, 'GET', readEndpoint, null, sessionA);
  assert(finalRead.status === 200 && finalRead.data.page?.title === distinctServerPage.title,
    'newest legitimate server edit must survive stale replay');
  assert(!sameCommittedPageContent(finalRead.data.page, lostAckPage),
    'different content must not be auto-recovered as a successful stale retry');
  const publicAfterFaults = await api(baseUrl, 'GET', `${endpoint}?public=1&fresh=${Date.now()}`);
  assert(publicAfterFaults.status === 200 && publicAfterFaults.data.page?.title === distinctServerPage.title,
    'public latest page must reflect the truly last committed revision after network faults');
  runtimeResult.divergentChangesProtected = true;

  runtimeResult.reconnection = true;

  // Never record login tokens, verification codes, PII or complete page payload.
  console.log(JSON.stringify({ ok: true, scope: 'ed-r11-isolated-signed-session-http-e2e', ...runtimeResult }));
}, {
  name: 'ed-r11-authenticated-http-e2e',
  env: {
    INLET_SESSION_AUTH_MODE: 'strict',
    INLET_SESSION_SECRET: 'ed-r11-temp-only-signing-secret',
    INLET_PROJECT_AUTH_ENFORCE: '1',
    INLET_AUTH_EMAIL_MODE: 'mock',
    INLET_EMAIL_PROVIDER: 'mock',
  },
});
