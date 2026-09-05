const QA_SLUG_PREFIX = 'qa-save-roundtrip-';
const baseUrl = String(process.env.INLET_PRODUCTION_SAVE_BASE_URL || 'https://pagero.kr').trim().replace(/\/+$/, '');
const configuredOrigins = String(process.env.PAGERO_PRODUCTION_SAVE_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const initialSession = String(process.env.INLET_PRODUCTION_SAVE_SESSION || '').trim();
const productionQaSecret = String(process.env.INLET_PRODUCTION_SAVE_QA_SECRET || '').trim();
const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.INLET_PRODUCTION_SAVE_TIMEOUT_MS || 12000)));

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 300),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  };
}

function assertLaunchGate() {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    fail('production save probe base URL is invalid');
  }
  if (url.protocol !== 'https:') fail('production save probe requires HTTPS');
  if (url.pathname !== '/' || url.search || url.hash) fail('production save probe base URL must be an origin only');
  if (!configuredOrigins.includes(baseUrl)) fail('production save probe target is not in the approved origin list', { baseUrl });
  if (!initialSession && !productionQaSecret) fail('production save probe fixture credential is missing');
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
      data = { text };
    }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`request timed out: ${method} ${path}`, { timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function pageListDigest(pages = []) {
  return (Array.isArray(pages) ? pages : [])
    .map((page) => `${page.id || ''}|${page.projectId || ''}|${page.slug || ''}`)
    .sort()
    .join('\n');
}

function qaPages(pages = []) {
  return (Array.isArray(pages) ? pages : []).filter((page) => String(page?.slug || '').startsWith(QA_SLUG_PREFIX));
}

async function mintProductionQaSession() {
  const { response, data } = await requestJson('/api/qa/production-save-session', {
    method: 'POST',
    headers: { 'X-Inlet-Production-QA-Secret': productionQaSecret },
  });
  if (!response.ok) fail('production QA session mint failed', { status: response.status, code: data.code || '' });
  const session = String(data.session || '').trim();
  if (!session) fail('production QA session mint returned no session');
  if (data.fixture?.platformMaster) fail('production QA session must never be platform master');
  return session;
}

async function refreshSession(session) {
  const { response, data } = await requestJson('/api/auth/session', { session });
  if (!response.ok) fail('production fixture session refresh failed', { status: response.status, code: data.code || '' });
  const user = data.user || {};
  if (!user.ownerId || !user.email) fail('production fixture session is missing account identity');
  if (user.platformMaster) fail('production save probe refuses platform-master fixture');
  return { session: String(data.session || session), user };
}

async function readPages(session) {
  const { response, data } = await requestJson('/api/projects', { session });
  if (!response.ok) fail('production fixture page list failed', { status: response.status, code: data.code || '' });
  return Array.isArray(data.pages) ? data.pages : [];
}

async function hardCleanupQaProject(projectId) {
  if (!productionQaSecret) return { ok: false, skipped: true };
  const { response, data } = await requestJson('/api/qa/production-save-session', {
    method: 'POST',
    headers: { 'X-Inlet-Production-QA-Secret': productionQaSecret },
    body: { action: 'cleanup', projectId },
  });
  if (!response.ok) {
    fail('production QA hard cleanup failed', { status: response.status, code: data.code || '', projectId });
  }
  return data.cleanup || { ok: true };
}
async function deleteQaPage(session, page) {
  const slug = String(page?.slug || '');
  const projectId = String(page?.projectId || '');
  const ownerId = String(page?.ownerId || '');
  if (!slug.startsWith(QA_SLUG_PREFIX) || !projectId) fail('refusing to delete a non-QA page');
  const query = new URLSearchParams({ projectId, ownerId, slug });
  const { response, data } = await requestJson(`/api/pages/${encodeURIComponent(slug)}?${query}`, {
    session,
    method: 'DELETE',
    headers: { 'X-Inlet-Project-Id': projectId },
  });
  if (!response.ok && response.status !== 404) {
    fail('production QA page cleanup failed', { status: response.status, code: data.code || '' });
  }
}

async function cleanupResidue(session) {
  const pages = await readPages(session);
  const residue = qaPages(pages);
  for (const page of residue) {
    await deleteQaPage(session, page);
    await hardCleanupQaProject(String(page.projectId || ''));
  }
  const after = await readPages(session);
  if (qaPages(after).length) fail('production QA page residue remains after cleanup');
  return { removed: residue.length, pages: after };
}

function savePayload({ mode, page, ownerId, projectId, slug, expectedRevision = 0, expectedUpdatedAt = '', requestId }) {
  return {
    project: { projectId, ownerId, slug },
    page,
    identity: {
      mode,
      pageId: page.id,
      projectId,
      ownerId,
      revision: expectedRevision,
      slug,
    },
    saveMode: mode,
    saveRequestId: requestId,
    tab: 'edit',
    ...(expectedRevision ? { expectedRevision } : {}),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    reason: `production-save-roundtrip-${mode}`,
  };
}

async function main() {
  assertLaunchGate();
  const sessionInput = initialSession || await mintProductionQaSession();
  const refreshed = await refreshSession(sessionInput);
  let session = refreshed.session;
  const ownerId = String(refreshed.user.ownerId);

  const preCleanup = await cleanupResidue(session);
  const baselinePages = preCleanup.pages;
  const baselineDigest = pageListDigest(baselinePages);
  if (baselinePages.length !== 0) fail('production save probe requires the dedicated empty-page fixture', { activePages: baselinePages.length });

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `${QA_SLUG_PREFIX}${stamp}`.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80);
  const projectId = `${ownerId}_${slug}`.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 180);
  const pageId = `page_${projectId}`.slice(0, 180);
  const path = `/api/pages/${encodeURIComponent(slug)}?${new URLSearchParams({ saveMode: 'create-new', pageId, projectId })}`;

  let createdPage = null;
  const evidence = {
    ok: false,
    targetOrigin: baseUrl,
    qaSlugPrefix: QA_SLUG_PREFIX,
    baselineActivePages: baselinePages.length,
    fixtureSource: initialSession ? 'configured-session' : 'ephemeral-production-qa',
    cleanupBefore: preCleanup.removed,
    checks: [],
    secretValuesIncluded: false,
  };

  try {
    const embeddedQaImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZC8sAAAAASUVORK5CYII=';
    const pageV1 = {
      id: pageId,
      projectId,
      ownerId,
      slug,
      title: 'Production Save QA v1',
      blocks: [{
        id: `hero-${stamp}`,
        type: 'hero',
        s: { title: 'Production Save QA v1', image: embeddedQaImage },
      }],
    };
    const saveV1 = await requestJson(path, {
      session,
      method: 'POST',
      headers: { 'X-Inlet-Project-Id': projectId },
      body: savePayload({
        mode: 'create-new',
        page: pageV1,
        ownerId,
        projectId,
        slug,
        requestId: `production-save-roundtrip:${stamp}:v1`,
      }),
    });
    createdPage = saveV1.data?.page || null;
    const revisionV1 = Number(createdPage?.revision || 0);
    const savedImage = String(createdPage?.blocks?.[0]?.s?.image || '');
    const pageAssets = saveV1.data?.pageAssets || {};
    if (!saveV1.response.ok || createdPage?.title !== 'Production Save QA v1' || revisionV1 < 1) {
      fail('production D1 save v1 failed', { status: saveV1.response.status, code: saveV1.data?.code || '', revision: revisionV1 });
    }
    if (Number(pageAssets.replaced || 0) < 1 || !savedImage.startsWith('/api/files/download?key=')) {
      fail('production R2 page image externalization failed', {
        replaced: Number(pageAssets.replaced || 0),
        uploaded: Number(pageAssets.uploaded || 0),
        externalized: savedImage.startsWith('/api/files/download?key='),
      });
    }
    evidence.checks.push({
      name: 'save-v1',
      status: 'ready',
      revision: revisionV1,
      pageImageExternalized: true,
      r2Uploaded: Number(pageAssets.uploaded || 0) >= 1,
    });

    const pageV2 = {
      ...pageV1,
      revision: revisionV1,
      createdAt: createdPage.createdAt || '',
      updatedAt: createdPage.updatedAt || '',
      title: 'Production Save QA v2',
      blocks: [{ id: `hero-${stamp}`, type: 'hero', s: { title: 'Production Save QA v2' } }],
    };
    const updatePath = `/api/pages/${encodeURIComponent(slug)}?${new URLSearchParams({ saveMode: 'update-existing', pageId, projectId })}`;
    const saveV2 = await requestJson(updatePath, {
      session,
      method: 'POST',
      headers: { 'X-Inlet-Project-Id': projectId },
      body: savePayload({
        mode: 'update-existing',
        page: pageV2,
        ownerId,
        projectId,
        slug,
        expectedRevision: revisionV1,
        expectedUpdatedAt: createdPage.updatedAt || '',
        requestId: `production-save-roundtrip:${stamp}:v2`,
      }),
    });
    const savedV2 = saveV2.data?.page || null;
    const revisionV2 = Number(savedV2?.revision || 0);
    if (!saveV2.response.ok || savedV2?.title !== 'Production Save QA v2' || revisionV2 <= revisionV1) {
      fail('production D1 save v2 failed', { status: saveV2.response.status, code: saveV2.data?.code || '', revisionV1, revisionV2 });
    }
    createdPage = savedV2;
    evidence.checks.push({ name: 'save-v2', status: 'ready', revision: revisionV2 });

    const authedRead = await requestJson(`/api/pages/${encodeURIComponent(slug)}?projectId=${encodeURIComponent(projectId)}`, {
      session,
      headers: { 'X-Inlet-Project-Id': projectId },
    });
    if (!authedRead.response.ok || authedRead.data?.page?.title !== 'Production Save QA v2' || Number(authedRead.data?.page?.revision || 0) !== revisionV2) {
      fail('authenticated production D1 readback mismatch', { status: authedRead.response.status });
    }
    evidence.checks.push({ name: 'authenticated-readback', status: 'ready', revision: revisionV2 });

    const publicRead = await requestJson(`/api/pages/${encodeURIComponent(slug)}?public=1`);
    if (!publicRead.response.ok || publicRead.data?.page?.title !== 'Production Save QA v2' || Number(publicRead.data?.page?.revision || 0) !== revisionV2) {
      fail('public production D1 readback mismatch', { status: publicRead.response.status });
    }
    evidence.checks.push({ name: 'public-readback', status: 'ready', revision: revisionV2 });
  } finally {
    const pages = await readPages(session).catch(() => []);
    const currentQaPages = qaPages(pages);
    for (const page of currentQaPages) {
      try {
        await deleteQaPage(session, page);
      } catch (error) {
        evidence.cleanupError = safeError(error);
      }
    }
    try {
      const cleanup = await hardCleanupQaProject(projectId);
      evidence.r2CleanupDeleted = Number(cleanup?.r2Deleted || 0);
      evidence.hardCleanup = cleanup?.skipped ? 'skipped' : 'ready';
    } catch (error) {
      evidence.cleanupError = safeError(error);
    }
    const finalPages = await readPages(session).catch(() => []);
    evidence.cleanupAfter = currentQaPages.length;
    evidence.finalActivePages = finalPages.length;
    evidence.baselineRestored = pageListDigest(finalPages) === baselineDigest && qaPages(finalPages).length === 0;
    if (!evidence.baselineRestored) process.exitCode = 1;
  }

  evidence.ok = evidence.checks.length === 4 && evidence.checks.every((check) => check.status === 'ready') && evidence.baselineRestored && !evidence.cleanupError;
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  if (!evidence.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, status: 'failed-live', error: safeError(error), secretValuesIncluded: false }, null, 2)}\n`);
  process.exitCode = 1;
});
