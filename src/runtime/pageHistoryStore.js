const PAGE_HISTORY_LIMIT = 50;
const PAGE_HISTORY_COALESCE_MS = 700;
const IDENTITY_FIELDS = ['id', 'pageId', 'projectId', 'ownerId', 'ownerAccountId', 'revision', 'updatedAt', 'savedAt', 'createdAt', 'status'];

const listeners = new Set();
let runtimeApply = null;
let suppressionDepth = 0;
let state = {
  identity: '',
  past: [],
  future: [],
  current: null,
  lastMutationAt: 0,
  lastShape: '',
};

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value || '').trim();
}

function blockIdentity(page = {}) {
  const ids = (page.blocks || [])
    .map((block) => text(block?.id))
    .filter(Boolean)
    .sort();
  return ids.length ? ids.join('.') : '';
}

export function pageHistoryIdentity(page = {}) {
  const project = text(page.projectId || page.workspaceId || 'project');
  const owner = text(page.ownerId || page.ownerAccountId || page.accountId || 'owner');
  const stablePage = text(page.id || page.pageId || page.createdAt || blockIdentity(page) || page.slug || 'page');
  return [project, owner, stablePage].map((part) => encodeURIComponent(part)).join(':');
}

function contentSignature(page = {}) {
  const comparable = clone(page) || {};
  for (const key of ['revision', 'updatedAt', 'savedAt', 'createdAt', '__accountProjectAccess']) delete comparable[key];
  return JSON.stringify(comparable);
}

function structureSignature(page = {}) {
  return JSON.stringify((page.blocks || []).map((block) => [block?.id || '', block?.type || '', block?.visible !== false]));
}

function restoreCurrentServerIdentity(snapshot = {}, currentPage = {}) {
  const restored = clone(snapshot) || {};
  for (const field of IDENTITY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(currentPage || {}, field)) restored[field] = currentPage[field];
  }
  return restored;
}

function publicState() {
  return {
    identity: state.identity,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoCount: state.past.length,
    redoCount: state.future.length,
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function resetForPage(page) {
  state = {
    identity: pageHistoryIdentity(page),
    past: [],
    future: [],
    current: clone(page),
    lastMutationAt: 0,
    lastShape: structureSignature(page),
  };
  emit();
}

function emitHistoryToast(message, tone = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('builder:toast', { detail: { message, tone } }));
}

export function subscribePageHistory(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPageHistoryState() {
  return publicState();
}

export function bindPageHistoryRuntime({ setPage, commitLocalPageDraft }) {
  if (typeof setPage !== 'function' || typeof commitLocalPageDraft !== 'function') return;
  runtimeApply = (snapshot) => {
    setPage((currentPage) => {
      const nextPage = restoreCurrentServerIdentity(snapshot, currentPage);
      suppressionDepth += 1;
      try {
        return commitLocalPageDraft(nextPage);
      } finally {
        suppressionDepth = Math.max(0, suppressionDepth - 1);
      }
    });
  };
}

export function syncPageHistoryPage(page) {
  if (!page) return;
  const identity = pageHistoryIdentity(page);
  if (!state.identity || state.identity !== identity) {
    resetForPage(page);
    return;
  }
  state.current = clone(page);
}

export function recordPageHistoryMutation(currentPage, nextPage, now = Date.now()) {
  if (!nextPage) return;
  const current = clone(currentPage || state.current || nextPage);
  const next = clone(nextPage);
  const identity = pageHistoryIdentity(next);

  if (!state.identity || state.identity !== identity || pageHistoryIdentity(current) !== identity) {
    resetForPage(current);
    state.identity = identity;
  }

  if (suppressionDepth > 0) {
    state.current = next;
    state.lastShape = structureSignature(next);
    return;
  }

  if (contentSignature(current) === contentSignature(next)) {
    state.current = next;
    return;
  }

  const currentShape = structureSignature(current);
  const nextShape = structureSignature(next);
  const canCoalesce = state.past.length > 0
    && now - state.lastMutationAt <= PAGE_HISTORY_COALESCE_MS
    && currentShape === nextShape
    && currentShape === state.lastShape;

  if (!canCoalesce) {
    state.past = [...state.past, current].slice(-PAGE_HISTORY_LIMIT);
  }
  state.future = [];
  state.current = next;
  state.lastMutationAt = now;
  state.lastShape = nextShape;
  emit();
}

export function undoPageHistory() {
  if (!state.past.length || !state.current || !runtimeApply) return false;
  const previous = state.past[state.past.length - 1];
  const current = clone(state.current);
  state.past = state.past.slice(0, -1);
  state.future = [current, ...state.future].slice(0, PAGE_HISTORY_LIMIT);
  state.current = restoreCurrentServerIdentity(previous, current);
  state.lastMutationAt = 0;
  state.lastShape = structureSignature(state.current);
  emit();
  runtimeApply(state.current);
  emitHistoryToast('이전 편집 상태로 되돌렸습니다.');
  return true;
}

export function redoPageHistory() {
  if (!state.future.length || !state.current || !runtimeApply) return false;
  const next = state.future[0];
  const current = clone(state.current);
  state.future = state.future.slice(1);
  state.past = [...state.past, current].slice(-PAGE_HISTORY_LIMIT);
  state.current = restoreCurrentServerIdentity(next, current);
  state.lastMutationAt = 0;
  state.lastShape = structureSignature(state.current);
  emit();
  runtimeApply(state.current);
  emitHistoryToast('되돌린 편집을 다시 적용했습니다.');
  return true;
}

export function clearPageHistory(page = null) {
  if (page) resetForPage(page);
  else {
    state = { identity: '', past: [], future: [], current: null, lastMutationAt: 0, lastShape: '' };
    emit();
  }
}

export const PAGE_HISTORY_MAX_STEPS = PAGE_HISTORY_LIMIT;
export const PAGE_HISTORY_TYPING_WINDOW_MS = PAGE_HISTORY_COALESCE_MS;
