import { pageOperationIdentity } from './pageOperationIdentity.js';

export function visibleEditorPublishState({ page, saved, saveStatus, hasUnappliedDrafts = false } = {}) {
  const samePage = saveStatus?.savedPageIdentity === pageOperationIdentity(page);
  if (saveStatus?.phase === 'publishing') return { label: '발행 중', tone: 'warning', detail: saveStatus.detail };
  if (hasUnappliedDrafts) return { label: '미적용 변경 · 미발행', tone: 'warning', detail: '변경을 적용한 후 발행해야 공개 페이지에 반영됩니다.' };
  if (saveStatus?.tone === 'error') return { label: saveStatus.label, tone: 'error', detail: saveStatus.detail };
  if (saveStatus?.tone === 'warning') return { label: saveStatus.label, tone: 'warning', detail: saveStatus.detail };
  if (saved && samePage && saveStatus?.tone === 'ok') return { label: saveStatus.label, tone: 'ok', detail: '공개 페이지에 반영된 발행 결과입니다.', at: saveStatus.at };
  if (saveStatus?.phase === 'dirty') return { label: '공개 미반영 · 편집 중', tone: 'idle', detail: '변경 내용은 공개 페이지에 아직 반영되지 않았습니다.' };
  if (saveStatus?.label === '브라우저에 임시저장됨') return { label: '브라우저 임시보관 · 미발행', tone: 'idle', detail: '공개 페이지에 반영하려면 발행하세요.' };
  return { label: page?.publishedAt ? '이전 발행본 있음' : '발행 전', tone: 'idle', detail: '변경 사항을 공개하려면 발행하세요.' };
}

export function createSaveStatusMarker(setSaveStatus) {
  return function markSaveStatus(tone, label, detail = '', options = {}) {
    // Optional page scope applies only to the success flash. Other status
    // call sites keep their existing signature and feedback behavior.
    const savedPageIdentity = typeof options?.savedPageIdentity === 'string'
      ? options.savedPageIdentity : '';
    setSaveStatus({
      tone, label, detail, at: new Date().toISOString(),
      ...(savedPageIdentity ? { savedPageIdentity } : {}),
      ...(options.phase ? { phase: options.phase } : {}),
    });
  };
}

export function createLocalJsonSaver({ saveJson, storageErrorMessage, saveErrorNoticeRef, markSaveStatus, showToast }) {
  return function saveLocalJson(key, value, label, options = {}) {
    const result = saveJson(key, value);
    if (result?.ok) {
      if (!options.quietSuccess && (!saveErrorNoticeRef.current || saveErrorNoticeRef.current.startsWith(`${key}:`))) {
        saveErrorNoticeRef.current = '';
        markSaveStatus('ok', '브라우저에 임시저장됨', '');
      }
      return result;
    }

    const detail = storageErrorMessage(result?.error);
    const message = '브라우저 임시저장에 실패했습니다.';
    const signature = `${key}:${result?.reason || 'unknown'}:${String(result?.error?.message || result?.error || '')}`;
    console.warn(`Local save failed (${label}):`, detail);
    markSaveStatus('error', '임시저장 실패', message);
    if (saveErrorNoticeRef.current !== signature) {
      saveErrorNoticeRef.current = signature;
      showToast(message, 'error');
    }
    return result;
  };
}
