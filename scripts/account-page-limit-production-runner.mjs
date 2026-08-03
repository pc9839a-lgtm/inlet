import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createOriginLockedFetch,
  evaluateLaunchGate,
  normalizeAllowedOrigins,
} from './account-page-limit-production-safe-entry.mjs';

const APPROVAL_PHRASE = 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES';
const QA_SLUG_PREFIX = 'qa-limit-';
const SESSION_ENV = Object.freeze({
  emptyGeneral: 'INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION',
  occupiedGeneral: 'INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION',
  archivedGeneral: 'INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION',
  platformMaster: 'INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION',
  googleGeneral: 'INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION',
  manager: 'INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION',
});
const EXPECTED_PLATFORM_MASTER = Object.freeze({
  emptyGeneral: false,
  occupiedGeneral: false,
  archivedGeneral: false,
  platformMaster: true,
  googleGeneral: false,
  manager: false,
});
const DISTINCT_OWNER_LABELS = Object.freeze([
  'emptyGeneral',
  'occupiedGeneral',
  'archivedGeneral',
  'platformMaster',
  'googleGeneral',
]);

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

function printResult(result, error = false) {
  const output = `${JSON.stringify({ ...result, secretValuesIncluded: false }, null, 2)}\n`;
  if (error) process.stderr.write(output);
  else process.stdout.write(output);
}

function requestUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  return new URL(String(input?.url || ''));
}

function requestSessionHeader(input, init = {}) {
  const headers = new Headers(init.headers || (typeof input === 'object' ? input?.headers : undefined));
  return String(headers.get('X-Inlet-Session') || '');
}

function canonicalPageIdentity(page = {}) {
  return [
    String(page.id || ''),
    String(page.projectId || page.project?.projectId || ''),
    String(page.slug || ''),
  ].join('|');
}

export function pageIdentityDigest(pages = []) {
  const identities = (Array.isArray(pages) ? pages : [])
    .map(canonicalPageIdentity)
    .sort();
  return {
    count: identities.length,
    digest: createHash('sha256').update(JSON.stringify(identities)).digest('hex').slice(0, 16),
    identities,
  };
}

export function findQaResidue(pageSets = {}) {
  const labels = {};
  let total = 0;
  for (const [label, pages] of Object.entries(pageSets || {})) {
    const matches = (Array.isArray(pages) ? pages : []).filter((page) => String(page?.slug || '').startsWith(QA_SLUG_PREFIX));
    if (matches.length) labels[label] = matches.length;
    total += matches.length;
  }
  return { total, labels };
}

export function compareFixtureBaselines(before = {}, after = {}) {
  const labels = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
  const mismatches = [];
  for (const label of labels) {
    const expected = pageIdentityDigest(before[label]);
    const actual = pageIdentityDigest(after[label]);
    if (expected.digest !== actual.digest || expected.count !== actual.count) {
      mismatches.push({
        label,
        expectedCount: expected.count,
        actualCount: actual.count,
        expectedDigest: expected.digest,
        actualDigest: actual.digest,
      });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

function summarizePageSets(pageSets = {}) {
  return Object.fromEntries(Object.entries(pageSets).map(([label, pages]) => {
    const summary = pageIdentityDigest(pages);
    return [label, { count: summary.count, digest: summary.digest }];
  }));
}

function parseCheckerOutput(stdout, stderr) {
  for (const candidate of [stdout, stderr]) {
    const text = String(candidate || '').trim();
    if (!text) continue;
    try {
      return JSON.parse(text);
    } catch {
      // Keep trying the other stream. The final evidence never includes raw session-bearing output.
    }
  }
  return {
    ok: false,
    status: 'failed-live',
    reason: 'live checker did not emit one parseable JSON result',
  };
}

async function requestJson(baseUrl, pathName, { session = '', method = 'GET', body, headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathName}`, {
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
      data = {};
    }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`request timed out: ${method} ${pathName}`, { timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function currentSessions() {
  return Object.fromEntries(Object.entries(SESSION_ENV).map(([label, envName]) => [
    label,
    String(process.env[envName] || '').trim(),
  ]));
}

function duplicateSessionLabels(sessions) {
  const groups = new Map();
  for (const [label, value] of Object.entries(sessions)) {
    if (!value) continue;
    const labels = groups.get(value) || [];
    labels.push(label);
    groups.set(value, labels);
  }
  return [...groups.values()].filter((labels) => labels.length > 1);
}

function installTrackedOriginFetch(targetOrigin, runtimeSessions) {
  const lockedFetch = createOriginLockedFetch(targetOrigin, globalThis.fetch);
  globalThis.fetch = async (input, init = {}) => {
    const url = requestUrl(input);
    const requestedSession = requestSessionHeader(input, init);
    const response = await lockedFetch(input, init);
    if (url.pathname === '/api/auth/session' && response.ok && requestedSession) {
      try {
        const data = await response.clone().json();
        const refreshedSession = String(data?.session || '');
        if (refreshedSession) {
          for (const [label, currentSession] of runtimeSessions.entries()) {
            if (currentSession !== requestedSession) continue;
            runtimeSessions.set(label, refreshedSession);
            process.env[SESSION_ENV[label]] = refreshedSession;
          }
        }
      } catch {
        // The normal checker will report an invalid session response. Do not log token material here.
      }
    }
    return response;
  };
}

async function refreshFixture(baseUrl, label, runtimeSessions, timeoutMs) {
  const session = runtimeSessions.get(label) || '';
  const { response, data } = await requestJson(baseUrl, '/api/auth/session', { session, timeoutMs });
  if (!response.ok) fail(`${label} session refresh failed during integrity check`, {
    status: response.status,
    code: data.code || data?.details?.code || '',
  });
  const user = data.user || {};
  if (!user.ownerId || !user.email) fail(`${label} integrity session response is missing identity`);
  const expectedPlatformMaster = EXPECTED_PLATFORM_MASTER[label];
  if (Boolean(user.platformMaster) !== expectedPlatformMaster) {
    fail(`${label} integrity platform-master state mismatch`, {
      expected: expectedPlatformMaster,
      actual: Boolean(user.platformMaster),
    });
  }
  return user;
}

async function readFixturePages(baseUrl, label, runtimeSessions, timeoutMs) {
  const session = runtimeSessions.get(label) || '';
  const { response, data } = await requestJson(baseUrl, '/api/projects', { session, timeoutMs });
  if (!response.ok) fail(`${label} page list failed during integrity check`, {
    status: response.status,
    code: data.code || data?.details?.code || '',
  });
  return Array.isArray(data.pages) ? data.pages : [];
}

async function captureFixtureState(baseUrl, runtimeSessions, timeoutMs) {
  const users = {};
  const pages = {};
  for (const label of Object.keys(SESSION_ENV)) {
    users[label] = await refreshFixture(baseUrl, label, runtimeSessions, timeoutMs);
    pages[label] = await readFixturePages(baseUrl, label, runtimeSessions, timeoutMs);
  }
  return { users, pages };
}

function assertFixtureIsolation(users) {
  const ownerGroups = new Map();
  for (const label of DISTINCT_OWNER_LABELS) {
    const ownerId = String(users[label]?.ownerId || '');
    const labels = ownerGroups.get(ownerId) || [];
    labels.push(label);
    ownerGroups.set(ownerId, labels);
  }
  const duplicates = [...ownerGroups.values()].filter((labels) => labels.length > 1);
  if (duplicates.length) fail('disposable fixture owner accounts are not isolated', { duplicateLabelGroups: duplicates });
}

function assertFixtureShape(pages) {
  if ((pages.emptyGeneral || []).length !== 0) fail('empty-general fixture must start with zero active pages');
  if ((pages.occupiedGeneral || []).length < 1) fail('occupied-general fixture must start with at least one active page');
  if ((pages.archivedGeneral || []).length !== 0) fail('archived-general fixture must start with zero active pages');
  const residue = findQaResidue(pages);
  if (residue.total) fail('stale qa-limit pages exist before verification; manual review is required', residue);
}

async function deleteQaPage(baseUrl, label, page, runtimeSessions, timeoutMs) {
  const slug = String(page?.slug || '');
  const projectId = String(page?.projectId || page?.project?.projectId || '');
  const ownerId = String(page?.ownerId || '');
  if (!slug.startsWith(QA_SLUG_PREFIX) || !projectId) {
    fail('integrity cleanup refused a non-QA page', { label });
  }
  const query = new URLSearchParams({ projectId, ownerId, slug });
  const { response, data } = await requestJson(baseUrl, `/api/pages/${encodeURIComponent(slug)}?${query}`, {
    session: runtimeSessions.get(label) || '',
    method: 'DELETE',
    headers: { 'X-Inlet-Project-Id': projectId },
    timeoutMs,
  });
  if (!response.ok && response.status !== 404) {
    fail('integrity cleanup could not delete a current-run QA page', {
      label,
      status: response.status,
      code: data.code || data?.details?.code || '',
    });
  }
}

async function restoreFixtureIntegrity(baseUrl, baselinePages, runtimeSessions, timeoutMs) {
  let state = await captureFixtureState(baseUrl, runtimeSessions, timeoutMs);
  const residueBefore = findQaResidue(state.pages);
  const cleanupErrors = [];
  let cleanupAttempted = 0;
  if (residueBefore.total) {
    for (const [label, pages] of Object.entries(state.pages)) {
      const qaPages = pages.filter((page) => String(page?.slug || '').startsWith(QA_SLUG_PREFIX));
      for (const page of qaPages.reverse()) {
        cleanupAttempted += 1;
        try {
          await deleteQaPage(baseUrl, label, page, runtimeSessions, timeoutMs);
        } catch (error) {
          cleanupErrors.push(safeError(error));
        }
      }
    }
    state = await captureFixtureState(baseUrl, runtimeSessions, timeoutMs);
  }
  const residueAfter = findQaResidue(state.pages);
  const baselineComparison = compareFixtureBaselines(baselinePages, state.pages);
  return {
    ok: residueAfter.total === 0 && cleanupErrors.length === 0 && baselineComparison.ok,
    cleanupAttempted,
    cleanupErrors,
    residueBefore,
    residueAfter,
    baselineComparison,
    pageSets: summarizePageSets(state.pages),
  };
}

async function runChecker() {
  const stdout = [];
  const stderr = [];
  const originalLog = console.log;
  const originalError = console.error;
  const previousExitCode = Number(process.exitCode || 0);
  process.exitCode = 0;
  let thrown = null;
  try {
    console.log = (...args) => stdout.push(args.map(String).join(' '));
    console.error = (...args) => stderr.push(args.map(String).join(' '));
    const checker = path.join(process.cwd(), 'scripts', 'account-page-limit-production-check.mjs');
    await import(`${pathToFileURL(checker).href}?integrity=${Date.now()}`);
  } catch (error) {
    thrown = safeError(error);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  const exitCode = Number(process.exitCode || 0);
  process.exitCode = previousExitCode;
  const result = parseCheckerOutput(stdout.join('\n'), stderr.join('\n'));
  return {
    exitCode: thrown ? 1 : exitCode,
    result,
    ...(thrown ? { thrown } : {}),
  };
}

async function main() {
  const requireLive = process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE === '1';
  const writeEnabled = process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE === '1';
  const approval = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL || '');
  const baseUrl = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_BASE_URL || 'https://pagero.kr');
  const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.INLET_ACCOUNT_PAGE_LIMIT_TIMEOUT_MS || 12000)));

  let allowedOrigins;
  try {
    allowedOrigins = normalizeAllowedOrigins(process.env.PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS || '');
  } catch (error) {
    printResult({
      ok: false,
      status: 'failed-live',
      phase: 'launch-gate',
      reason: `invalid allowed-origin configuration: ${String(error?.message || error)}`,
    }, true);
    process.exitCode = 1;
    return;
  }

  const gate = evaluateLaunchGate({ baseUrl, allowedOrigins, writeEnabled, approval });
  if (!gate.ok) {
    const securityFailure = gate.errors.some((message) => (
      message.includes('HTTPS')
      || message.includes('credentials')
      || message.includes('origin only')
      || message.includes('not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS')
    ));
    const status = securityFailure ? 'failed-live' : 'skipped-live';
    printResult({
      ok: securityFailure ? false : !requireLive,
      status,
      phase: 'launch-gate',
      targetOrigin: gate.targetOrigin || null,
      writeEnabled,
      errors: gate.errors,
    }, securityFailure || requireLive);
    if (securityFailure || requireLive) process.exitCode = 1;
    return;
  }

  const sessions = currentSessions();
  const missingSessions = Object.entries(sessions).filter(([, value]) => !value).map(([label]) => label);
  if (missingSessions.length) {
    printResult({
      ok: !requireLive,
      status: 'skipped-live',
      phase: 'fixture-gate',
      reason: 'one or more disposable fixture sessions are missing',
      missingSessions,
    }, requireLive);
    if (requireLive) process.exitCode = 1;
    return;
  }
  const duplicatedSessions = duplicateSessionLabels(sessions);
  if (duplicatedSessions.length) {
    printResult({
      ok: false,
      status: 'failed-live',
      phase: 'fixture-gate',
      reason: 'fixture sessions must be unique',
      duplicateLabelGroups: duplicatedSessions,
    }, true);
    process.exitCode = 1;
    return;
  }

  process.env.INLET_ACCOUNT_PAGE_LIMIT_BASE_URL = gate.targetOrigin;
  const runtimeSessions = new Map(Object.entries(sessions));
  installTrackedOriginFetch(gate.targetOrigin, runtimeSessions);

  let baseline;
  try {
    baseline = await captureFixtureState(gate.targetOrigin, runtimeSessions, timeoutMs);
    assertFixtureIsolation(baseline.users);
    assertFixtureShape(baseline.pages);
  } catch (error) {
    printResult({
      ok: false,
      status: 'failed-live',
      phase: 'preflight-integrity',
      targetOrigin: gate.targetOrigin,
      error: safeError(error),
    }, true);
    process.exitCode = 1;
    return;
  }

  const checker = await runChecker();
  let postflight;
  try {
    postflight = await restoreFixtureIntegrity(gate.targetOrigin, baseline.pages, runtimeSessions, timeoutMs);
  } catch (error) {
    postflight = {
      ok: false,
      error: safeError(error),
    };
  }

  const checkerVerified = checker.exitCode === 0
    && checker.result?.ok === true
    && checker.result?.status === 'verified-live';
  const ok = checkerVerified && postflight.ok === true;
  const result = {
    ok,
    status: ok ? 'verified-live' : 'failed-live',
    targetOrigin: gate.targetOrigin,
    integrity: {
      preflight: {
        fixtureOwnersIsolated: true,
        staleQaResidue: 0,
        pageSets: summarizePageSets(baseline.pages),
      },
      postflight,
    },
    checker: {
      exitCode: checker.exitCode,
      result: checker.result,
      ...(checker.thrown ? { thrown: checker.thrown } : {}),
    },
  };
  printResult(result, !ok);
  if (!ok) process.exitCode = 1;
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  main().catch((error) => {
    printResult({
      ok: false,
      status: 'failed-live',
      phase: 'runner',
      error: safeError(error),
    }, true);
    process.exitCode = 1;
  });
}
