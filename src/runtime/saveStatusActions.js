export function createSaveStatusMarker(setSaveStatus) {
  return function markSaveStatus(tone, label, detail = '') {
    setSaveStatus({ tone, label, detail, at: new Date().toISOString() });
  };
}

export function createLocalJsonSaver({ saveJson, storageErrorMessage, saveErrorNoticeRef, markSaveStatus, showToast }) {
  return function saveLocalJson(key, value, label, options = {}) {
    const result = saveJson(key, value);
    if (result?.ok) {
      if (!options.quietSuccess && (!saveErrorNoticeRef.current || saveErrorNoticeRef.current.startsWith(`${key}:`))) {
        saveErrorNoticeRef.current = '';
        markSaveStatus('ok', '브라우저에 저장됨', '');
      }
      return result;
    }

    const detail = storageErrorMessage(result?.error);
    const message = '브라우저 임시 저장에 실패했습니다.';
    const signature = `${key}:${result?.reason || 'unknown'}:${String(result?.error?.message || result?.error || '')}`;
    console.warn(`Local save failed (${label}):`, detail);
    markSaveStatus('error', '임시 저장 실패', message);
    if (saveErrorNoticeRef.current !== signature) {
      saveErrorNoticeRef.current = signature;
      showToast(message, 'error');
    }
    return result;
  };
}
