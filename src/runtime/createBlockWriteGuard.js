export function createBlockWriteGuard({ canWriteTabKey, showToast, markSaveStatus, messages }) {
  return function blockWrite(targetTab) {
    if (canWriteTabKey(targetTab)) return false;
    showToast(messages.toast, 'warning');
    markSaveStatus('warning', messages.statusLabel, messages.statusDetail);
    return true;
  };
}
