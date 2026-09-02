let unsavedDirty = false;
let recoveryFlusher = null;
let allowNextUnload = false;

export function setWorkspaceUnsavedDirty(value) {
  unsavedDirty = !!value;
  if (!unsavedDirty) allowNextUnload = false;
}

export function workspaceHasUnsavedChanges() {
  return unsavedDirty;
}

export function setWorkspaceRecoveryFlusher(flusher) {
  recoveryFlusher = typeof flusher === 'function' ? flusher : null;
}

export function flushWorkspaceRecoveryDraft() {
  if (!unsavedDirty) return true;
  if (!recoveryFlusher) return false;
  try {
    return recoveryFlusher() !== false;
  } catch {
    return false;
  }
}

export function discardWorkspaceUnsavedState() {
  unsavedDirty = false;
  allowNextUnload = false;
}

export function confirmWorkspaceLeaveSync({
  message = '저장하지 않은 변경사항이 있습니다. 이동하면 서버에는 반영되지 않습니다. 그래도 이동할까요?',
  allowUnload = false,
} = {}) {
  if (!unsavedDirty) {
    if (allowUnload) allowNextUnload = true;
    return true;
  }

  const recoverySaved = flushWorkspaceRecoveryDraft();
  if (!recoverySaved) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('현재 작업을 브라우저에 임시 보관하지 못했습니다. 화면을 닫지 말고 저장을 다시 시도해주세요.');
    }
    return false;
  }

  if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
  const confirmed = window.confirm(message);
  if (confirmed && allowUnload) allowNextUnload = true;
  return confirmed;
}

export function shouldBlockWorkspaceBeforeUnload() {
  if (allowNextUnload) {
    allowNextUnload = false;
    return false;
  }
  return unsavedDirty;
}

export function resetWorkspaceUnsavedGuardForTests() {
  unsavedDirty = false;
  recoveryFlusher = null;
  allowNextUnload = false;
}
