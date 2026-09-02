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
