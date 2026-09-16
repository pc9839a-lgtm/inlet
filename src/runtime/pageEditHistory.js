const MAX_HISTORY = 50;

let past = [];
let future = [];
let applyingHistory = false;
let configuredSetPage = null;
let configuredCommitPage = null;
let activeScope = '';
let listeners = new Set();
let stateSnapshot = {
  canUndo: false,
  canRedo: false,
  undoCount: 0,
  redoCount: 0,
};

function clonePage(page) {
  if (!page || typeof page !== 'object') return page;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(page); } catch {}
  }
  return JSON.parse(JSON.stringify(page));
}

function pageScope(page = {}) {
  const projectId = String(page.projectId || '').trim();
  const ownerId = String(page.ownerId || page.ownerAccountId || '').trim();
  const pageId = String(page.id || page.pageId || '').trim();
  if (pageId) return `${ownerId}:${projectId}:${pageId}`;
  return `${ownerId}:${projectId}:unsaved`;
}

function samePageContent(left, right) {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function refreshSnapshot() {
  stateSnapshot = {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
  };
}

function notify() {
  refreshSnapshot();
  listeners.forEach((listener) => listener());
}

function notifySoon() {
  if (typeof queueMicrotask === 'function') queueMicrotask(notify);
  else Promise.resolve().then(notify);
}

function resetStacks({ notifyListeners = true } = {}) {
  past = [];
  future = [];
  if (notifyListeners) notifySoon();
  else refreshSnapshot();
}

function trimPast() {
  if (past.length > MAX_HISTORY) past = past.slice(past.length - MAX_HISTORY);
}

export function configurePageEditHistory({ setPage, commitPage } = {}) {
  if (typeof setPage === 'function') configuredSetPage = setPage;
  if (typeof commitPage === 'function') configuredCommitPage = commitPage;
}

export function syncPageEditHistoryScope(page) {
  const nextScope = pageScope(page);
  if (!activeScope) {
    activeScope = nextScope;
    return;
  }
  if (nextScope && activeScope !== nextScope) {
    activeScope = nextScope;
    resetStacks();
  }
}

export function recordPageEditMutation(previousPage, nextPage) {
  if (applyingHistory || !previousPage || !nextPage) return;

  const previousScope = pageScope(previousPage);
  const nextScope = pageScope(nextPage);
  if (!activeScope) activeScope = previousScope || nextScope;

  if (previousScope && nextScope && previousScope !== nextScope) {
    activeScope = nextScope;
    resetStacks();
    return;
  }

  if (samePageContent(previousPage, nextPage)) return;

  past.push(clonePage(previousPage));
  trimPast();
  future = [];
  notifySoon();
}

export function getPageEditHistoryState() {
  return stateSnapshot;
}

export function subscribePageEditHistory(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function undoPageEdit() {
  if (!configuredSetPage || !configuredCommitPage || !past.length) return false;
  const target = past[past.length - 1];

  configuredSetPage((currentPage) => {
    past = past.slice(0, -1);
    future.push(clonePage(currentPage));
    if (future.length > MAX_HISTORY) future = future.slice(future.length - MAX_HISTORY);
    applyingHistory = true;
    try {
      return configuredCommitPage(clonePage(target));
    } finally {
      applyingHistory = false;
      notifySoon();
    }
  });
  return true;
}

export function redoPageEdit() {
  if (!configuredSetPage || !configuredCommitPage || !future.length) return false;
  const target = future[future.length - 1];

  configuredSetPage((currentPage) => {
    future = future.slice(0, -1);
    past.push(clonePage(currentPage));
    trimPast();
    applyingHistory = true;
    try {
      return configuredCommitPage(clonePage(target));
    } finally {
      applyingHistory = false;
      notifySoon();
    }
  });
  return true;
}

export function clearPageEditHistory() {
  resetStacks();
}

export const PAGE_EDIT_HISTORY_LIMIT = MAX_HISTORY;
