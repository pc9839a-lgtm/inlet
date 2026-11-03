import { pageOperationIdentity } from './pageOperationIdentity.js';

// Two independent editor status tracks: the local editable draft and the
// published public version. This is presentation-only; existing persistence,
// verification, retry and queue actions are not changed.
export function visibleEditorDraftState({ page, saveStatus, hasUnappliedDrafts = false } = {}) {
  if (saveStatus?.label === '임시저장 실패') {
    return { kind: 'failed', label: '임시보관 실패', tone: 'error', detail: saveStatus.detail || '편집 내용의 브라우저 보관에 실패했습니다.' };
  }
  if (saveStatus?.phase === 'saving') {
    return { kind: 'saving', label: '임시저장 중', tone: 'warning', detail: saveStatus.detail || '브라우저에 편집 내용을 보관하고 있습니다.' };
  }
  if (hasUnappliedDrafts) {
    return { kind: 'unapplied', label: '미적용 변경', tone: 'warning', detail: '스타일 또는 코드의 변경을 편집본에 아직 적용하지 않았습니다.' };
  }
  if (saveStatus?.phase === 'dirty') {
    return { kind: 'dirty', label: '편집본 변경됨', tone: 'warning', detail: '최신 변경사항은 공개 페이지에 반영되지 않았습니다.' };
  }
  if (saveStatus?.label === '브라우저에 임시저장됨') {
    return { kind: 'stored', label: '브라우저 임시보관됨', tone: 'ok', detail: '브라우저에 보관된 편집본이며 공개 페이지에 게시된 것은 아닙니다.' };
  }
  const samePage = saveStatus?.savedPageIdentity === pageOperationIdentity(page);
  if (samePage && saveStatus?.tone === 'ok' && saveStatus?.label === '발행됨') {
    return { kind: 'published', label: '편집본 발행됨', tone: 'ok', detail: '마지막 발행 당시의 편집본을 서버에 보냈습니다.' };
  }
  return { kind: 'ready', label: '편집본 준비', tone: 'idle', detail: '내용을 변경한 뒤 공개하려면 발행하세요.' };
}

export function visibleEditorPublishState({ page, saved, saveStatus, hasUnappliedDrafts = false } = {}) {
  const samePage = saveStatus?.savedPageIdentity === pageOperationIdentity(page);
  const publishing = saveStatus?.phase === 'publishing';
  // A failure or unverified publication must remain visible even if another
  // style/code change is still unapplied. Never replace an error with "dirty".
  if (publishing) return { kind: 'publishing', label: '발행 중', tone: 'warning', detail: saveStatus.detail, actionLabel: '발행 중' };
  if (saveStatus?.tone === 'error') {
    const isPublishError = /발행|저장|충돌|로그인/.test(saveStatus.label || '');
    return { kind: 'failed', label: saveStatus.label || '발행 실패', tone: 'error', detail: saveStatus.detail, actionLabel: isPublishError ? '다시 발행' : '게시하기' };
  }
  if (saveStatus?.tone === 'warning' && saveStatus?.phase !== 'dirty') {
    return { kind: 'verification', label: saveStatus.label, tone: 'warning', detail: saveStatus.detail, actionLabel: /확인|지연|실패/.test(saveStatus.label || '') ? '다시 발행' : '게시하기' };
  }
  if (hasUnappliedDrafts) {
    return { kind: 'unapplied', label: '미발행 변경', tone: 'warning', detail: '미적용 스타일·코드를 편집본에 적용한 뒤 발행해야 공개됩니다.', actionLabel: '적용 후 발행' };
  }
  if (saveStatus?.phase === 'dirty') {
    return { kind: 'dirty', label: '미발행 변경', tone: 'warning', detail: '편집 중인 변경사항은 공개 페이지에 반영되지 않았습니다.', actionLabel: '게시하기' };
  }
  if (samePage && saveStatus?.tone === 'ok' && saveStatus?.label === '발행됨') {
    return { kind: 'published', label: '발행됨', tone: 'ok', detail: '현재 페이지를 서버에 발행한 결과입니다.', at: saveStatus.at, actionLabel: '발행됨' };
  }
  if (saveStatus?.label === '브라우저에 임시저장됨') {
    return { kind: 'stored', label: '미발행 변경', tone: 'warning', detail: '브라우저에는 임시보관됐지만 공개 페이지에는 아직 반영되지 않았습니다.', actionLabel: '게시하기' };
  }
  if (page?.publishedAt) {
    return { kind: 'previous', label: '이전 발행본 있음', tone: 'idle', detail: '이전 공개본이 존재합니다. 편집본과 공개본의 일치 여부는 확인되지 않았습니다.', actionLabel: '게시하기' };
  }
  return { kind: 'before', label: '발행 전', tone: 'idle', detail: '변경사항을 공개하려면 발행하세요.', actionLabel: '게시하기' };
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
