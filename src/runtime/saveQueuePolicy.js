/**
 * A queued save may carry a partial pageOverride from a click that happened
 * before more edits. Apply only its intended differences to the latest page:
 * when the user subsequently edits the same field, the later input wins.
 * Plain objects merge field-by-field; arrays are atomic because their index
 * positions can change while blocks are reordered.
 */
const SERVER_OWNED_FIELDS = new Set([
  'id', 'pageId', 'projectId', 'ownerId', 'ownerAccountId',
  'revision', 'updatedAt', 'savedAt', 'createdAt', 'publishedAt',
  '__accountProjectAccess',
]);

function plainRecord(value) {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function contentEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (left === undefined || right === undefined) return false;
  try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
}

function resolveFieldAtDrain(base, override, latest) {
  if (contentEqual(base, override)) return latest;
  if (plainRecord(base) && plainRecord(override) && plainRecord(latest)) {
    const merged = { ...latest };
    for (const [key, value] of Object.entries(override)) {
      // The override's edit intent cannot resurrect a field deleted after
      // the click or replace a different value typed in the meantime.
      if (Object.prototype.hasOwnProperty.call(base, key)
        && !Object.prototype.hasOwnProperty.call(latest, key)) continue;
      if (!Object.prototype.hasOwnProperty.call(base, key)
        && Object.prototype.hasOwnProperty.call(latest, key)) continue;
      merged[key] = resolveFieldAtDrain(base[key], value, latest[key]);
    }
    return merged;
  }
  return contentEqual(base, latest) ? override : latest;
}

export function resolveQueuedPageOverride({ basePage, latestPage, pageOverride } = {}) {
  if (pageOverride == null) return latestPage || basePage || null;
  const base = plainRecord(basePage) ? basePage : {};
  const latest = plainRecord(latestPage) ? latestPage : base;
  if (!plainRecord(pageOverride)) return latest;
  const resolved = { ...latest };
  for (const [key, value] of Object.entries(pageOverride)) {
    // Identity and server revision must come from the latest active page.
    if (SERVER_OWNED_FIELDS.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(base, key)
      && !Object.prototype.hasOwnProperty.call(latest, key)) continue;
    if (!Object.prototype.hasOwnProperty.call(base, key)
      && Object.prototype.hasOwnProperty.call(latest, key)) continue;
    resolved[key] = resolveFieldAtDrain(base[key], value, latest[key]);
  }
  return resolved;
}

export function nextTrailingSaveRequest({
  result,
  queued = false,
  queuedRequest = null,
  automaticRequest = null,
} = {}) {
  if (!result?.ok || result?.reason === 'inactive-page') {
    return { continue: false, request: null, reason: result?.reason || 'save-failed' };
  }

  if (queued) {
    return {
      continue: true,
      request: queuedRequest,
      reason: 'explicit-queued-save',
    };
  }

  if (result?.pendingChanges && automaticRequest != null) {
    return {
      continue: true,
      request: automaticRequest,
      reason: 'changes-during-save',
    };
  }

  return { continue: false, request: null, reason: 'stable' };
}

/**
 * A completed save for page A must never mutate page B. However, an explicit
 * save click on B while A was in flight must not be discarded with A's
 * inactive-page result. Resume only if the queued click still targets B.
 */
export function resumeExplicitSaveForActivePage({
  result,
  queuedTargetIdentity = '',
  activeTargetIdentity = '',
  queuedRequest = null,
} = {}) {
  if (result?.reason !== 'inactive-page') return null;
  if (!queuedRequest || !queuedTargetIdentity || queuedTargetIdentity !== activeTargetIdentity) return null;
  return queuedRequest;
}
