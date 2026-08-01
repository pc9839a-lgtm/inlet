const baseUrl = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_BASE_URL || 'https://pagero.kr').replace(/\/+$/, '');
const requireLive = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE || '') === '1';
const allowWrites = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE || '') === '1';
const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.INLET_ACCOUNT_PAGE_LIMIT_TIMEOUT_MS || 12000)));

const sessions = {
  emptyGeneral: String(process.env.INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION || '').trim(),
  occupiedGeneral: String(process.env.INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION || '').trim(),
  archivedGeneral: String(process.env.INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION || '').trim(),
  platformMaster: String(process.env.INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION || '').trim(),
  googleGeneral: String(process.env.INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION || '').trim(),
  manager: String(process.env.INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION || '').trim(),
};

const requiredSessionNames = Object.keys(sessions);
const missingSessions = requiredSessionNames.filter((name) => !sessions[name]);
const evidence = [];
const cleanupQueue = [];

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function record(name, status, details = {}) {
  evidence.push({ name, status, ...details });
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 300),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  };
}

async function requestJson(path, { session = '', method = 'GET', body, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session ? { 'X-Inlet-Session': session } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`request timed out: ${method} ${path}`, { timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sessionSnapshot(label, session, expectedPlatformMaster) {
  const { response, data } = await requestJson('/api/auth/session', { session });
  if (!response.ok) fail(`${label} session refresh failed`, { status: response.status, code: data.code || data?.details?.code || '' });
  const user = data.user || {};
  if (!user.ownerId || !user.email) fail(`${label} session response is missing identity`);
  if (expectedPlatformMaster !== undefined && Boolean(user.platformMaster) !== expectedPlatformMaster) {
    fail(`${label} platform-master state mismatch`, { expected: expectedPlatformMaster, actual: Boolean(user.platformMaster) });
  }
  record(`${label}:session-refresh`, 'passed', { platformMaster: Boolean(user.platformMaster) });
  return { user, session: String(data.session || session) };
}

async function accountPages(label, session) {
  const { response, data } = await requestJson('/api/projects', { session });
  if (!response.ok) fail(`${label} page list failed`, { status: response.status, code: data.code || data?.details?.code || '' });
  const pages = Array.isArray(data.pages) ? data.pages : [];
  record(`${label}:page-list`, 'passed', { count: pages.length });
  return pages;
}

function uniqueSlug(label) {
  return `qa-limit-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
}

function pagePayload(user, slug, { saveMode = 'create-new', page = null } = {}) {
  const projectId = String(page?.projectId || `project-${slug}`);
  const ownerId = String(user.ownerId || '');
  const nextPage = page || {
    id: '',
    projectId,
    ownerId,
    slug,
    title: `Page limit QA ${slug}`,
    theme: { accent: '#2563eb', bg: '#ffffff', text: '#111827' },
    settings: {},
    blocks: [{ id: 'hero', type: 'hero', visible: true, s: { title: 'Page limit QA', body: slug } }],
  };
  const identity = {
    mode: saveMode,
    pageId: String(nextPage.id || ''),
    projectId,
    ownerId,
    revision: Math.max(0, Number(nextPage.revision || 0)),
    slug,
  };
  return {
    project: { projectId, ownerId, slug, title: nextPage.title || slug },
    page: { ...nextPage, projectId, ownerId, slug },
    identity,
    saveMode,
    saveRequestId: `${saveMode}:${projectId}:${identity.pageId || 'page'}:${slug}:${identity.revision}`,
    ...(saveMode === 'update-existing' ? {
      expectedRevision: identity.revision,
      expectedUpdatedAt: String(nextPage.updatedAt || ''),
    } : {}),
  };
}

async function createPage(label, snapshot, slug, expectedStatus = 200) {
  const payload = pagePayload(snapshot.user, slug);
  const { response, data } = await requestJson(`/api/pages/${encodeURIComponent(slug)}`, {
    session: snapshot.session,
    method: 'POST',
    body: payload,
    headers: { 'X-Inlet-Project-Id': payload.project.projectId },
  });
  if (response.status !== expectedStatus) {
    fail(`${label} creation status mismatch`, {
      expectedStatus,
      actualStatus: response.status,
      code: data.code || data?.details?.code || '',
    });
  }
  if (expectedStatus === 409 && data.code !== 'ACCOUNT_PAGE_LIMIT_REACHED') {
    fail(`${label} did not return ACCOUNT_PAGE_LIMIT_REACHED`, { code: data.code || '' });
  }
  if (response.ok) {
    const saved = data.page || {};
    if (!saved.id || !saved.projectId || saved.slug !== slug) fail(`${label} create response is missing saved page identity`);
    cleanupQueue.push({ label, session: snapshot.session, page: saved });
    record(`${label}:create`, 'passed', { status: response.status });
    return saved;
  }
  record(`${label}:blocked`, 'passed', { status: response.status, code: data.code });
  return null;
}

async function updateAndVerifyExisting(snapshot, page) {
  const payload = pagePayload(snapshot.user, page.slug, {
    saveMode: 'update-existing',
    page: {
      ...page,
      title: page.title || 'Page limit QA',
      blocks: Array.isArray(page.blocks) ? page.blocks : [],
    },
  });
  const save = await requestJson(`/api/pages/${encodeURIComponent(page.slug)}`, {
    session: snapshot.session,
    method: 'POST',
    body: payload,
    headers: { 'X-Inlet-Project-Id': page.projectId },
  });
  if (!save.response.ok) fail('existing page update failed', { status: save.response.status, code: save.data.code || '' });
  const saved = save.data.page || {};
  const query = new URLSearchParams({ projectId: saved.projectId, ownerId: snapshot.user.ownerId, slug: saved.slug });
  const revisions = await requestJson(`/api/pages/${encodeURIComponent(saved.slug)}/revisions?${query}`, { session: snapshot.session });
  if (!revisions.response.ok || !Array.isArray(revisions.data.revisions) || revisions.data.revisions.length < 1) {
    fail('existing page revision history failed', { status: revisions.response.status });
  }
  const revisionId = revisions.data.revisions.at(-1)?.id || revisions.data.revisions[0]?.id;
  const preview = await requestJson(`/api/pages/${encodeURIComponent(saved.slug)}/revisions/${encodeURIComponent(revisionId)}?${query}`, { session: snapshot.session });
  if (!preview.response.ok || !preview.data.revision?.id) fail('existing page revision preview failed', { status: preview.response.status });
  const restore = await requestJson(`/api/pages/${encodeURIComponent(saved.slug)}/restore`, {
    session: snapshot.session,
    method: 'POST',
    body: { project: payload.project, revisionId },
    headers: { 'X-Inlet-Project-Id': saved.projectId },
  });
  if (!restore.response.ok || !restore.data.page?.id) fail('existing page revision restore failed', { status: restore.response.status });
  const publicRead = await requestJson(`/api/pages/${encodeURIComponent(saved.slug)}?public=1&fresh=${Date.now()}`);
  if (!publicRead.response.ok || publicRead.data.page?.slug !== saved.slug) fail('existing page public read failed', { status: publicRead.response.status });
  record('empty-general:existing-save-revision-restore-public', 'passed');
  return restore.data.page;
}

async function deletePage(item) {
  const page = item.page || {};
  if (!page.slug || !page.projectId) return;
  const query = new URLSearchParams({ projectId: page.projectId, ownerId: page.ownerId || '', slug: page.slug });
  const result = await requestJson(`/api/pages/${encodeURIComponent(page.slug)}?${query}`, {
    session: item.session,
    method: 'DELETE',
    headers: { 'X-Inlet-Project-Id': page.projectId },
  });
  if (!result.response.ok && result.response.status !== 404) {
    fail(`${item.label} cleanup failed`, { status: result.response.status, code: result.data.code || '' });
  }
  record(`${item.label}:cleanup`, 'passed');
}

async function cleanupAll() {
  const errors = [];
  for (const item of cleanupQueue.splice(0).reverse()) {
    try {
      await deletePage(item);
    } catch (error) {
      errors.push(safeError(error));
    }
  }
  if (errors.length) fail('one or more QA pages could not be cleaned up', { errors });
}

async function main() {
  if (missingSessions.length || !allowWrites) {
    const reason = missingSessions.length
      ? `missing test sessions: ${missingSessions.join(', ')}`
      : 'INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE is not enabled';
    const output = {
      ok: !requireLive,
      status: 'skipped-live',
      reason,
      baseUrl,
      writeEnabled: allowWrites,
      missingSessions,
    };
    console.log(JSON.stringify(output, null, 2));
    if (requireLive) process.exitCode = 1;
    return;
  }

  const emptyGeneral = await sessionSnapshot('empty-general', sessions.emptyGeneral, false);
  const occupiedGeneral = await sessionSnapshot('occupied-general', sessions.occupiedGeneral, false);
  const archivedGeneral = await sessionSnapshot('archived-general', sessions.archivedGeneral, false);
  const platformMaster = await sessionSnapshot('platform-master', sessions.platformMaster, true);
  const googleGeneral = await sessionSnapshot('google-general', sessions.googleGeneral, false);
  const manager = await sessionSnapshot('manager', sessions.manager, false);

  const emptyBefore = await accountPages('empty-general', emptyGeneral.session);
  if (emptyBefore.length !== 0) fail('empty-general fixture must have zero active pages', { count: emptyBefore.length });
  const occupiedBefore = await accountPages('occupied-general', occupiedGeneral.session);
  if (occupiedBefore.length < 1) fail('occupied-general fixture must have at least one active page');
  const archivedBefore = await accountPages('archived-general', archivedGeneral.session);
  if (archivedBefore.length !== 0) fail('archived-general fixture must expose zero active pages', { count: archivedBefore.length });

  const firstSlug = uniqueSlug('general-first');
  const first = await createPage('empty-general:first', emptyGeneral, firstSlug, 200);
  await updateAndVerifyExisting(emptyGeneral, first);
  await createPage('empty-general:second', emptyGeneral, uniqueSlug('general-second'), 409);
  await cleanupAll();

  const replacement = await createPage('empty-general:replacement-after-delete', emptyGeneral, uniqueSlug('general-replacement'), 200);
  if (!replacement?.id) fail('general account could not create a replacement after deletion');
  await cleanupAll();

  await createPage('occupied-general:second', occupiedGeneral, uniqueSlug('occupied-second'), 409);
  const archivedFirst = await createPage('archived-general:first-after-archive', archivedGeneral, uniqueSlug('archived-first'), 200);
  if (!archivedFirst?.id) fail('archived project incorrectly counted against page quota');
  await cleanupAll();

  await createPage('platform-master:first', platformMaster, uniqueSlug('master-one'), 200);
  await createPage('platform-master:second', platformMaster, uniqueSlug('master-two'), 200);
  await sessionSnapshot('platform-master-after-writes', platformMaster.session, true);
  await cleanupAll();

  const googleBefore = await accountPages('google-general', googleGeneral.session);
  if (googleBefore.length === 0) await createPage('google-general:first', googleGeneral, uniqueSlug('google-first'), 200);
  await createPage('google-general:second', googleGeneral, uniqueSlug('google-second'), 409);
  await cleanupAll();

  const managerBefore = await accountPages('manager', manager.session);
  const managerAttempt = pagePayload(manager.user, uniqueSlug('manager-bypass'));
  const managerResult = await requestJson(`/api/pages/${encodeURIComponent(managerAttempt.page.slug)}`, {
    session: manager.session,
    method: 'POST',
    body: managerAttempt,
    headers: { 'X-Inlet-Project-Id': managerAttempt.project.projectId },
  });
  if (![403, 409].includes(managerResult.response.status)) {
    if (managerResult.response.ok && managerResult.data.page) cleanupQueue.push({ label: 'manager-unexpected-create', session: manager.session, page: managerResult.data.page });
    fail('manager/member path bypassed the owner page policy', { status: managerResult.response.status, code: managerResult.data.code || '' });
  }
  const managerAfter = await accountPages('manager-after-attempt', manager.session);
  if (managerAfter.length !== managerBefore.length) fail('manager/member attempt changed accessible page count');
  record('manager:bypass-blocked', 'passed', { status: managerResult.response.status });

  await cleanupAll();
  console.log(JSON.stringify({
    ok: true,
    status: 'verified-live',
    baseUrl,
    checks: evidence.length,
    evidence,
  }, null, 2));
}

try {
  await main();
} catch (error) {
  try {
    await cleanupAll();
  } catch (cleanupError) {
    error.cleanup = safeError(cleanupError);
  }
  console.error(JSON.stringify({
    ok: false,
    status: 'failed-live',
    baseUrl,
    error: safeError(error),
    ...(error.cleanup ? { cleanup: error.cleanup } : {}),
    evidence,
  }, null, 2));
  process.exitCode = 1;
}
