const MAX_HISTORY = 50;

// Unsaved pages can share the same default slug and lack a server page id.
// Give each in-memory editor page a stable, private history scope instead of
// grouping every draft in one global "unsaved" undo/redo stack.
const unsavedPageScopes = new WeakMap();
let nextUnsavedScope = 0;

function pageId(page = {}) {
  return String(page.id || page.pageId || '').trim();
}

function pageOwnerProject(page = {}) {
  return `${String(page.ownerId || page.ownerAccountId || '').trim()}:${String(page.projectId || '').trim()}`;
}

function unsavedPageScopeId(page) {
  let scopeId = unsavedPageScopes.get(page);
  if (!scopeId) {
    nextUnsavedScope += 1;
    scopeId = `draft-${nextUnsavedScope}`;
    unsavedPageScopes.set(page, scopeId);
  }
  return scopeId;
}

function carryUnsavedScope(previousPage, nextPage) {
  if (pageId(previousPage) || pageId(nextPage)) return;
  if (pageOwnerProject(previousPage) !== pageOwnerProject(nextPage)) return;
  // A changed slug may represent selection of a different unsaved page.
  // Reset its history rather than risking a cross-page undo.
  if (String(previousPage.slug || '') !== String(nextPage.slug || '')) return;
  if (!unsavedPageScopes.has(nextPage)) {
    unsavedPageScopes.set(nextPage, unsavedPageScopeId(previousPage));
  }
}


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
  let cloned = null;
  if (typeof structuredClone === 'function') {
    try { cloned = structuredClone(page); } catch {}
  }
  if (!cloned) cloned = JSON.parse(JSON.stringify(page));
  // Copy this only in memory: no history marker is added to a published page.
  const scopeId = unsavedPageScopes.get(page);
  if (scopeId && !pageId(page)) unsavedPageScopes.set(cloned, scopeId);
  return cloned;
}

function pageScope(page = {}) {
  const ownerProject = pageOwnerProject(page);
  const persistedId = pageId(page);
  if (persistedId) return `${ownerProject}:id:${persistedId}`;
  return `${ownerProject}:unsaved:${unsavedPageScopeId(page)}`;
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
  if (!previousPage || !nextPage) return;
  // Normalize/commit clones a page for every keystroke. Carry its private
  // identity across that edit and across undo/redo snapshots.
  carryUnsavedScope(previousPage, nextPage);
  if (applyingHistory) return;

  const previousScope = pageScope(previousPage);
  const nextScope = pageScope(nextPage);
  if (!activeScope) activeScope = previousScope || nextScope;
  if (activeScope !== previousScope) {
    activeScope = previousScope;
    resetStacks();
  }

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
    // Effects that synchronize history scope run after rendering. Block an
    // immediate shortcut/click on a newly selected page before that effect.
    const currentScope = pageScope(currentPage);
    if (currentScope !== activeScope || pageScope(target) !== currentScope) {
      activeScope = currentScope;
      resetStacks();
      return currentPage;
    }
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
    // Effects that synchronize history scope run after rendering. Block an
    // immediate shortcut/click on a newly selected page before that effect.
    const currentScope = pageScope(currentPage);
    if (currentScope !== activeScope || pageScope(target) !== currentScope) {
      activeScope = currentScope;
      resetStacks();
      return currentPage;
    }
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
