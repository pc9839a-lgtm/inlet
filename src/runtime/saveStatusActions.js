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
        markSaveStatus('ok', '\uB85C\uCEEC \uC800\uC7A5\uB428', `${label} \uC800\uC7A5 \uC644\uB8CC`);
      }
      return result;
    }

    const message = `${label} \uB85C\uCEEC \uC800\uC7A5 \uC2E4\uD328: ${storageErrorMessage(result?.error)}`;
    const signature = `${key}:${result?.reason || 'unknown'}:${String(result?.error?.message || result?.error || '')}`;
    markSaveStatus('error', '\uB85C\uCEEC \uC800\uC7A5 \uC2E4\uD328', message);
    if (saveErrorNoticeRef.current !== signature) {
      saveErrorNoticeRef.current = signature;
      showToast(message, 'error');
    }
    return result;
  };
}
