import {
  QA_MARKER_PREFIX,
  assertDedicatedQaSheetRows,
  exactMarkerRowIndices,
  isQaName,
  qaResidueRowIndices,
  rowsDigest,
  sanitizeGoogleSheetsEvidence,
} from './google-sheets-production-safety.mjs';

const baseOrigin = String(process.env.INLET_GOOGLE_SHEETS_BASE_URL || 'https://pagero.kr').replace(/\/+$/, '');
const phase = String(process.env.INLET_GOOGLE_SHEETS_LIVE_PHASE || 'read-only').trim().toLowerCase();
const requireLive = String(process.env.INLET_GOOGLE_SHEETS_LIVE_REQUIRE || '') === '1';
const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.INLET_GOOGLE_SHEETS_TIMEOUT_MS || 12000)));

const fixture = {
  session: String(process.env.INLET_GOOGLE_SHEETS_SESSION || '').trim(),
  projectId: String(process.env.INLET_GOOGLE_SHEETS_PROJECT_ID || '').trim(),
  pageSlug: String(process.env.INLET_GOOGLE_SHEETS_PAGE_SLUG || '').trim().toLowerCase(),
  spreadsheetId: String(process.env.INLET_GOOGLE_SHEETS_SPREADSHEET_ID || '').trim(),
  sheetName: String(process.env.INLET_GOOGLE_SHEETS_SHEET_NAME || '').trim(),
  clientId: String(process.env.INLET_GOOGLE_SHEETS_VERIFY_CLIENT_ID || '').trim(),
  clientSecret: String(process.env.INLET_GOOGLE_SHEETS_VERIFY_CLIENT_SECRET || ''),
  refreshToken: String(process.env.INLET_GOOGLE_SHEETS_VERIFY_REFRESH_TOKEN || '').trim(),
};

const evidence = [];
let accessToken = '';
let sheetId = null;
let marker = '';
let persistedPage = null;
let baselineRows = null;
let baselineDigest = '';

function sensitiveValues() {
  return [
    fixture.session,
    fixture.projectId,
    fixture.spreadsheetId,
    fixture.clientId,
    fixture.clientSecret,
    fixture.refreshToken,
    accessToken,
  ];
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = sanitizeGoogleSheetsEvidence(details, sensitiveValues());
  throw error;
}

function record(name, details = {}) {
  evidence.push({
    name,
    status: 'passed',
    ...sanitizeGoogleSheetsEvidence(details, sensitiveValues()),
  });
}

function responseCode(data = {}) {
  return String(data.code || data?.details?.code || '').trim();
}

function safeError(error) {
  return sanitizeGoogleSheetsEvidence({
    message: String(error?.message || error || 'unknown error').slice(0, 400),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  }, sensitiveValues());
}

function missingInputs() {
  return Object.entries(fixture).filter(([, value]) => value === '' || value == null).map(([key]) => key);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, redirect: 'error', signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') fail('live verification request timed out', { timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function pageroRequest(path, { method = 'GET', body, headers = {} } = {}) {
  if (process.env.INLET_GOOGLE_SHEETS_ORIGIN_VERIFIED !== '1') fail('Pagero origin was not verified by the safe entrypoint');
  const target = new URL(path, `${baseOrigin}/`);
  if (target.origin !== baseOrigin || !target.pathname.startsWith('/api/') || target.username || target.password) {
    fail('cross-origin or non-API Pagero request blocked', { path: target.pathname });
  }
  const response = await fetchWithTimeout(target, {
    method,
    headers: {
      Accept: 'application/json',
      ...(fixture.session ? { 'X-Inlet-Session': fixture.session } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 300) };
    }
  }
  return { response, data };
}

function assertGoogleTarget(target) {
  const parsed = target instanceof URL ? target : new URL(target);
  const noCredentials = !parsed.username && !parsed.password;
  const tokenEndpoint = parsed.origin === 'https://oauth2.googleapis.com'
    && parsed.pathname === '/token'
    && !parsed.search
    && !parsed.hash
    && noCredentials;
  const spreadsheetRoot = `/v4/spreadsheets/${encodeURIComponent(fixture.spreadsheetId)}`;
  const sheetsPathApproved = parsed.pathname === spreadsheetRoot
    || parsed.pathname.startsWith(`${spreadsheetRoot}/`)
    || parsed.pathname === `${spreadsheetRoot}:batchUpdate`;
  const sheetsEndpoint = parsed.origin === 'https://sheets.googleapis.com'
    && sheetsPathApproved
    && !parsed.hash
    && noCredentials;
  if (!tokenEndpoint && !sheetsEndpoint) {
    fail('unapproved Google API target blocked', {
      origin: parsed.origin,
      endpointType: parsed.origin === 'https://sheets.googleapis.com' ? 'sheets' : 'other',
    });
  }
  return parsed;
}

async function googleRequest(target, options = {}) {
  const parsed = assertGoogleTarget(target);
  return fetchWithTimeout(parsed, options);
}

async function refreshGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: fixture.clientId,
    client_secret: fixture.clientSecret,
    refresh_token: fixture.refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await googleRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    fail('Google OAuth token endpoint returned invalid JSON', { status: response.status });
  }
  if (!response.ok || !payload.access_token) fail('Google OAuth refresh failed', { status: response.status });
  accessToken = String(payload.access_token);
  record('google-oauth:refresh-token', { tokenType: String(payload.token_type || '').toLowerCase() || 'bearer' });
}

async function sheetsJson(path, { method = 'GET', body } = {}) {
  if (!accessToken) fail('Google access token is unavailable');
  const target = new URL(path, 'https://sheets.googleapis.com');
  const response = await googleRequest(target, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    fail('Google Sheets API returned invalid JSON', { status: response.status, endpointType: 'sheets' });
  }
  if (!response.ok) fail('Google Sheets API request failed', { status: response.status, endpointType: 'sheets' });
  return payload;
}

function quotedSheetRange() {
  const escaped = fixture.sheetName.replace(/'/g, "''");
  return `'${escaped}'!A:ZZ`;
}

async function loadSpreadsheetMetadata() {
  const fields = encodeURIComponent('properties.title,sheets.properties(sheetId,title)');
  const payload = await sheetsJson(`/v4/spreadsheets/${encodeURIComponent(fixture.spreadsheetId)}?fields=${fields}`);
  const spreadsheetTitle = String(payload?.properties?.title || '').trim();
  if (!isQaName(spreadsheetTitle)) fail('fixture spreadsheet title must start with QA');
  const sheet = (payload.sheets || []).find((item) => String(item?.properties?.title || '') === fixture.sheetName);
  if (!sheet || !Number.isInteger(Number(sheet.properties.sheetId))) fail('dedicated QA sheet was not found');
  sheetId = Number(sheet.properties.sheetId);
  record('google-sheets:fixture-metadata', {
    dedicatedQaSpreadsheet: true,
    dedicatedQaSheet: true,
  });
}

async function readSheetRows() {
  const range = encodeURIComponent(quotedSheetRange());
  const payload = await sheetsJson(`/v4/spreadsheets/${encodeURIComponent(fixture.spreadsheetId)}/values/${range}?majorDimension=ROWS`);
  return Array.isArray(payload.values) ? payload.values : [];
}

async function pollMarker(expectedCount, attempts = 18, delayMs = 3000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const rows = await readSheetRows();
    const indices = exactMarkerRowIndices(rows, marker);
    if (indices.length === expectedCount) return indices;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const finalRows = await readSheetRows();
  const finalIndices = exactMarkerRowIndices(finalRows, marker);
  fail('Google Sheets marker count mismatch', { expectedCount, actualCount: finalIndices.length });
}

async function deleteSheetRows(indices) {
  if (!indices.length) return;
  const requests = [...indices]
    .sort((a, b) => b - a)
    .map((index) => ({
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 },
      },
    }));
  await sheetsJson(`/v4/spreadsheets/${encodeURIComponent(fixture.spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: { requests },
  });
}

function fixtureProject() {
  return { projectId: fixture.projectId, slug: fixture.pageSlug };
}

function fixturePage() {
  if (!persistedPage) fail('persisted QA page is unavailable');
  return {
    id: persistedPage.id || '',
    projectId: persistedPage.projectId || fixture.projectId,
    title: persistedPage.title || 'Google Sheets Production QA',
    slug: persistedPage.slug || fixture.pageSlug,
    integrations: {
      sheets: { ...(persistedPage.integrations?.sheets || {}) },
    },
  };
}

async function verifyPageroFixture() {
  const session = await pageroRequest('/api/auth/session');
  if (!session.response.ok || !session.data?.user?.ownerId) {
    fail('fixture session refresh failed', { status: session.response.status, code: responseCode(session.data) });
  }
  record('pagero:session-refresh', { platformMaster: Boolean(session.data?.user?.platformMaster) });

  const projects = await pageroRequest('/api/projects');
  if (!projects.response.ok || !Array.isArray(projects.data?.pages)) {
    fail('fixture project list failed', { status: projects.response.status, code: responseCode(projects.data) });
  }
  const listedPage = projects.data.pages.find((item) => String(item.slug || '').toLowerCase() === fixture.pageSlug);
  if (!listedPage || String(listedPage.projectId || '') !== fixture.projectId) {
    fail('dedicated qa-sheets fixture page was not found');
  }

  const query = new URLSearchParams(fixtureProject()).toString();
  const pageResult = await pageroRequest(`/api/pages/${encodeURIComponent(fixture.pageSlug)}?${query}`);
  if (!pageResult.response.ok || !pageResult.data?.page) {
    fail('persisted qa-sheets fixture page could not be loaded', {
      status: pageResult.response.status,
      code: responseCode(pageResult.data),
    });
  }
  const page = pageResult.data.page;
  if (
    String(page.id || '') !== String(listedPage.id || '')
    || String(page.projectId || '') !== fixture.projectId
    || String(page.slug || '').toLowerCase() !== fixture.pageSlug
  ) {
    fail('persisted qa-sheets fixture identity does not match the project listing');
  }
  const sheets = page.integrations?.sheets || {};
  if (
    sheets.enabled !== true
    || String(sheets.mode || '').toLowerCase() !== 'oauth'
    || String(sheets.spreadsheetId || '').trim() !== fixture.spreadsheetId
    || String(sheets.sheetName || '').trim() !== fixture.sheetName
    || String(sheets.status || '').toLowerCase() !== 'connected'
  ) {
    fail('persisted qa-sheets page integration does not match the approved fixture');
  }
  persistedPage = page;
  record('pagero:qa-page-access', {
    slugPrefixVerified: true,
    persistedIntegrationMatched: true,
  });
}

function createMarker() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${QA_MARKER_PREFIX}${suffix}`;
}

function leadHasQaMarker(lead = {}, expected = '') {
  const values = [
    lead.id,
    lead.name,
    lead.memo,
    lead.message,
    lead.values?.qaMarker,
  ].map((value) => String(value || ''));
  if (expected) return values.some((value) => value === expected);
  return values.some((value) => value.startsWith(QA_MARKER_PREFIX));
}

async function listQaLeads(expected = '') {
  const query = new URLSearchParams({
    ...fixtureProject(),
    q: expected || QA_MARKER_PREFIX,
    limit: '100',
  }).toString();
  const result = await pageroRequest(`/api/leads?${query}`);
  if (!result.response.ok || !Array.isArray(result.data?.leads)) {
    fail('fixture lead residue lookup failed', {
      status: result.response.status,
      code: responseCode(result.data),
    });
  }
  return result.data.leads.filter((lead) => leadHasQaMarker(lead, expected));
}

async function verifyFixtureBaseline() {
  const rows = await readSheetRows();
  assertDedicatedQaSheetRows(rows);
  const residueRows = qaResidueRowIndices(rows);
  if (residueRows.length) fail('previous qa-sheets row residue exists in the fixture sheet', { residueCount: residueRows.length });
  const residueLeads = await listQaLeads();
  if (residueLeads.length) fail('previous qa-sheets lead residue exists in Pagero', { residueCount: residueLeads.length });
  baselineRows = rows;
  baselineDigest = rowsDigest(rows);
  record('fixture:clean-baseline', {
    headerOnly: true,
    priorSheetResidue: 0,
    priorLeadResidue: 0,
  });
}

function fixtureLead() {
  const digits = String(Date.now()).slice(-8);
  const createdAt = new Date().toISOString();
  return {
    id: marker,
    type: 'consult',
    kind: 'consult',
    status: 'new',
    name: marker,
    phone: `010${digits}`,
    memo: marker,
    values: {
      qaMarker: marker,
      source: 'google-sheets-production-verification',
    },
    createdAt,
    createdMonth: createdAt.slice(0, 7),
  };
}

async function deleteLead() {
  if (!marker) return;
  const query = new URLSearchParams(fixtureProject()).toString();
  const deleted = await pageroRequest(`/api/leads/${encodeURIComponent(marker)}?${query}`, { method: 'DELETE' });
  if (!deleted.response.ok && deleted.response.status !== 404) {
    fail('fixture lead cleanup failed', { status: deleted.response.status, code: responseCode(deleted.data) });
  }
}

async function cleanup() {
  const errors = [];
  if (marker && sheetId != null && accessToken) {
    try {
      const rows = await readSheetRows();
      const indices = exactMarkerRowIndices(rows, marker);
      await deleteSheetRows(indices);
      const afterDelete = await readSheetRows();
      const remaining = exactMarkerRowIndices(afterDelete, marker);
      if (remaining.length) fail('fixture sheet row cleanup verification failed', { remaining: remaining.length });
      if (baselineDigest && rowsDigest(afterDelete) !== baselineDigest) {
        fail('fixture sheet baseline was not restored after cleanup', {
          expectedBaseline: 'header-only',
          actualRowCount: afterDelete.length,
        });
      }
    } catch (error) {
      errors.push({ operation: 'sheet-row-delete', ...safeError(error) });
    }
  }

  if (marker) {
    try {
      await deleteLead();
      const remainingLeads = await listQaLeads(marker);
      if (remainingLeads.length) fail('fixture lead cleanup verification failed', { remaining: remainingLeads.length });
    } catch (error) {
      errors.push({ operation: 'lead-delete', ...safeError(error) });
    }
  }

  if (errors.length) fail('Google Sheets fixture cleanup failed', { errors });
}

async function verifyLiveDelivery() {
  marker = createMarker();
  if (!baselineRows || !baselineDigest) fail('clean fixture baseline must be captured before writes');
  if (exactMarkerRowIndices(baselineRows, marker).length) fail('generated marker already exists in fixture sheet');

  const project = fixtureProject();
  const page = fixturePage();
  const lead = fixtureLead();
  const saved = await pageroRequest('/api/leads', { method: 'POST', body: { project, page, lead } });
  if (!saved.response.ok || saved.data?.lead?.id !== marker) {
    fail('fixture lead save failed', { status: saved.response.status, code: responseCode(saved.data) });
  }
  const sheetLog = (saved.data?.delivery?.logs || []).find((log) => log.provider === 'google_sheets');
  if (!sheetLog || sheetLog.status !== 'success') {
    fail('Google Sheets OAuth delivery did not succeed', { deliveryStatus: String(sheetLog?.status || '') });
  }
  record('pagero:google-sheets-delivery', { deliveryStatus: 'success' });

  const firstRows = await pollMarker(1);
  if (firstRows[0] === 0) fail('QA marker unexpectedly replaced the sheet header');
  record('google-sheets:row-created-once', { count: 1 });

  const retried = await pageroRequest(`/api/leads/${encodeURIComponent(marker)}/deliver`, {
    method: 'POST',
    body: { project, page },
  });
  if (!retried.response.ok) {
    fail('delivery retry request failed', { status: retried.response.status, code: responseCode(retried.data) });
  }
  await new Promise((resolve) => setTimeout(resolve, 4000));
  await pollMarker(1, 4, 2000);
  record('google-sheets:idempotent-retry', { duplicateRows: 0 });

  const query = new URLSearchParams({ ...project, leadId: marker }).toString();
  const logs = await pageroRequest(`/api/leads/delivery-logs?${query}`);
  if (!logs.response.ok || !Array.isArray(logs.data?.logs)) {
    fail('delivery log lookup failed', { status: logs.response.status });
  }
  const googleLogs = logs.data.logs.filter((log) => log.provider === 'google_sheets');
  if (!googleLogs.some((log) => log.status === 'success' && log.idempotencyKey)) {
    fail('Google Sheets delivery log lacks successful idempotency evidence');
  }
  record('pagero:delivery-log-idempotency', {
    successfulProviderLogs: googleLogs.filter((log) => log.status === 'success').length,
  });
}

async function main() {
  if (process.env.INLET_GOOGLE_SHEETS_ORIGIN_VERIFIED !== '1') fail('safe entrypoint verification is required');
  if (!['read-only', 'verify-live'].includes(phase)) fail('unsupported Google Sheets verification phase', { phase });
  if (!/^qa-sheets-[a-z0-9-]+$/.test(fixture.pageSlug || '')) fail('fixture page slug must start with qa-sheets-');
  if (!isQaName(fixture.sheetName)) fail('fixture sheet name must start with QA');

  const missing = missingInputs();
  if (missing.length) {
    const output = {
      ok: !requireLive,
      status: 'skipped-live',
      phase,
      missing,
      reason: 'required disposable fixture or Google verification credentials are unavailable',
      secretValuesIncluded: false,
    };
    console.log(JSON.stringify(output, null, 2));
    if (requireLive) process.exitCode = 1;
    return;
  }

  await verifyPageroFixture();
  await refreshGoogleAccessToken();
  await loadSpreadsheetMetadata();
  await verifyFixtureBaseline();
  record('google-sheets:read-access', { readable: true });

  if (phase === 'read-only') {
    console.log(JSON.stringify({
      ok: true,
      status: 'verified-live',
      phase,
      checks: evidence.length,
      evidence,
      writesPerformed: false,
      secretValuesIncluded: false,
    }, null, 2));
    return;
  }

  await verifyLiveDelivery();
  await cleanup();
  record('fixture:cleanup-complete', {
    leadDeleted: true,
    sheetRowsDeleted: true,
    baselineRestored: true,
  });
  console.log(JSON.stringify({
    ok: true,
    status: 'verified-live',
    phase,
    checks: evidence.length,
    evidence,
    fixtureState: {
      leadDeleted: true,
      sheetRowsDeleted: true,
      baselineRestored: true,
    },
    secretValuesIncluded: false,
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
    error: safeError(error),
    ...(error.cleanup ? { cleanup: error.cleanup } : {}),
    evidence: sanitizeGoogleSheetsEvidence(evidence, sensitiveValues()),
    secretValuesIncluded: false,
  }, null, 2));
  process.exitCode = 1;
}
