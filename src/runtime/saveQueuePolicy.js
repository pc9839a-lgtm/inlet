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
