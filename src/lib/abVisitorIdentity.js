const VISITOR_KEY = 'pagero-ab-visitor-v1';
const SESSION_KEY = 'pagero-ab-session-v1';
let memoryVisitorId = '';
let memorySessionId = '';

function randomId(prefix) {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

function safeStorage(kind) {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function stableStoredId(storage, key, prefix, memoryValue, setMemory) {
  try {
    const existing = String(storage?.getItem?.(key) || '').trim();
    if (existing) {
      setMemory(existing);
      return existing;
    }
  } catch {}
  if (memoryValue) return memoryValue;
  const next = randomId(prefix);
  setMemory(next);
  try {
    storage?.setItem?.(key, next);
  } catch {}
  return next;
}

export function pageRoExperimentVisitorId() {
  return stableStoredId(
    safeStorage('local'),
    VISITOR_KEY,
    'v',
    memoryVisitorId,
    (value) => { memoryVisitorId = value; },
  );
}

export function pageRoExperimentSessionId() {
  return stableStoredId(
    safeStorage('session'),
    SESSION_KEY,
    's',
    memorySessionId,
    (value) => { memorySessionId = value; },
  );
}

export function pageRoExperimentIdentity() {
  return {
    visitorId: pageRoExperimentVisitorId(),
    sessionId: pageRoExperimentSessionId(),
  };
}

export function resetPageRoExperimentIdentityForTest() {
  memoryVisitorId = '';
  memorySessionId = '';
}

export const PAGE_RO_AB_VISITOR_KEY = VISITOR_KEY;
export const PAGE_RO_AB_SESSION_KEY = SESSION_KEY;
