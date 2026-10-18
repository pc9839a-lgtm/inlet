const MAX_HISTORY = 50;
const MAX_HISTORY_BYTES = 8 * 1024 * 1024;

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

// Store only the previous values of fields that actually changed. Full-page
// snapshots duplicated large unchanged image/block payloads on every keystroke.
function plainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function cloneChangedValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch {}
  }
  return JSON.parse(JSON.stringify(value));
}

function hasOwn(value, key) {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
    && Object.prototype.hasOwnProperty.call(value, key);
}

function arrayIdentityChanged(before, after) {
  return before.some((item, index) => {
    const next = after[index];
    return (plainRecord(item) && hasOwn(item, 'id'))
      || (plainRecord(next) && hasOwn(next, 'id'))
      ? item?.id !== next?.id : false;
  });
}

function previousValueChanges(before, after, path = [], operations = []) {
  if (Object.is(before, after)) return operations;
  if (Array.isArray(before) && Array.isArray(after)
    && before.length === after.length && !arrayIdentityChanged(before, after)) {
    before.forEach((item, index) => previousValueChanges(item, after[index], [...path, index], operations));
    return operations;
  }
  if (plainRecord(before) && plainRecord(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const hadBefore = hasOwn(before, key);
      const hasAfter = hasOwn(after, key);
      if (hadBefore && hasAfter) {
        previousValueChanges(before[key], after[key], [...path, key], operations);
      } else {
        operations.push({
          path: [...path, key],
          exists: hadBefore,
          value: hadBefore ? cloneChangedValue(before[key]) : undefined,
        });
      }
    }
    return operations;
  }
  operations.push({ path, exists: true, value: cloneChangedValue(before) });
  return operations;
}

function readPath(root, path) {
  if (!path.length) return { exists: true, value: root };
  let value = root;
  for (const key of path) {
    if (!hasOwn(value, key)) return { exists: false, value: undefined };
    value = value[key];
  }
  return { exists: true, value };
}

function applyOperation(root, operation) {
  const { path, exists, value } = operation;
  if (!path.length) return exists ? cloneChangedValue(value) : undefined;
  const ancestors = [root];
  let parent = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    parent = parent?.[path[index]];
    ancestors.push(parent);
  }
  let updated = Array.isArray(parent) ? parent.slice() : { ...(plainRecord(parent) ? parent : {}) };
  const leaf = path[path.length - 1];
  if (exists) updated[leaf] = cloneChangedValue(value);
  else delete updated[leaf];
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    const ancestorCopy = Array.isArray(ancestor) ? ancestor.slice() : { ...ancestor };
    ancestorCopy[path[index]] = updated;
    updated = ancestorCopy;
  }
  return updated;
}

function patchBytes(operations) {
  // A bounded estimate of JS string payloads (UTF-16) plus patch metadata.
  return JSON.stringify(operations).length * 2;
}

function historyEntry(scope, operations) {
  return { scope, operations, bytes: patchBytes(operations) };
}

function replayHistory(currentPage, entry) {
  let nextPage = currentPage;
  const inverse = [];
  for (const operation of entry.operations) {
    const current = readPath(nextPage, operation.path);
    inverse.push({
      path: operation.path,
      exists: current.exists,
      value: current.exists ? cloneChangedValue(current.value) : undefined,
    });
    nextPage = applyOperation(nextPage, operation);
  }
  return { nextPage, inverse: historyEntry(entry.scope, inverse) };
}

function historyBytes() {
  return [...past, ...future].reduce((total, entry) => total + entry.bytes, 0);
}
function trimHistory() {
  while (past.length > MAX_HISTORY) past.shift();
  while (future.length > MAX_HISTORY) future.shift();
  // Rare large block/image replacement may exceed the budget. Discard oldest
  // history rather than retaining potentially unbounded megabyte snapshots.
  while ((past.length || future.length) && historyBytes() > MAX_HISTORY_BYTES) {
    if (past.length) past.shift();
    else future.shift();
  }
}


function pageScope(page = {}) {
  const ownerProject = pageOwnerProject(page);
  const persistedId = pageId(page);
  if (persistedId) return `${ownerProject}:id:${persistedId}`;
  return `${ownerProject}:unsaved:${unsavedPageScopeId(page)}`;
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

  const operations = previousValueChanges(previousPage, nextPage);
  if (!operations.length) return;

  // Continuous edits to the same scalar field count as one user action.
  // Keep the first pre-edit value so Undo restores the entire typing gesture;
  // never coalesce structural block operations or edits after Undo.
  const change = operations.length === 1 ? operations[0] : null;
  const nextScalar = change ? readPath(nextPage, change.path).value : undefined;
  const groupable = change?.exists
    && (typeof change.value === 'string' || typeof change.value === 'number')
    && typeof nextScalar === typeof change.value
    && change.path.length > 0;
  const groupKey = groupable ? JSON.stringify(change.path) : '';
  const now = Date.now();
  const latest = past[past.length - 1];
  const canCoalesce = groupable && future.length === 0
    && latest?.scope === previousScope
    && latest?.groupKey === groupKey
    && now - (latest?.groupAt || 0) < 700;

  if (canCoalesce) {
    latest.groupAt = now;
  } else {
    const entry = historyEntry(previousScope, operations);
    if (groupable) {
      entry.groupKey = groupKey;
      entry.groupAt = now;
    }
    past.push(entry);
  }
  future = [];
  trimHistory();
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
    const currentScope = pageScope(currentPage);
    if (currentScope !== activeScope || target.scope !== currentScope) {
      activeScope = currentScope;
      resetStacks();
      return currentPage;
    }
    const { nextPage, inverse } = replayHistory(currentPage, target);
    past.pop();
    future.push(inverse);
    trimHistory();
    applyingHistory = true;
    try {
      return configuredCommitPage(nextPage);
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
    const currentScope = pageScope(currentPage);
    if (currentScope !== activeScope || target.scope !== currentScope) {
      activeScope = currentScope;
      resetStacks();
      return currentPage;
    }
    const { nextPage, inverse } = replayHistory(currentPage, target);
    future.pop();
    past.push(inverse);
    trimHistory();
    applyingHistory = true;
    try {
      return configuredCommitPage(nextPage);
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

export function getPageEditHistoryDiagnostics() {
  return { pastEntries: past.length, futureEntries: future.length, retainedBytes: historyBytes(), maxBytes: MAX_HISTORY_BYTES };
}
