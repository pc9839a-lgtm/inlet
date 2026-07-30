import { useCallback, useEffect, useRef } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import {
  clearPageDraft,
  evaluatePageDraft,
  pageDraftIdentity,
  readPageDraft,
  restorePageDraft,
  savePageDraft,
} from './pageDraftStore.js';

const DRAFT_SAVE_DELAY_MS = 550;

function formatDraftTime(value) {
  try {
    return new Date(Number(value || Date.now())).toLocaleString('ko-KR');
  } catch {
    return '';
  }
}

export function useServerPageDraftRecovery({
  accountPageReadyKey,
  authUser,
  canWrite,
  draftPage,
  hasPendingStyle,
  latestPageRef,
  localPageMutationRef,
  markSaveStatus,
  page,
  publicLandingSlug,
  requestConfirm,
  setPage,
  showToast,
}) {
  const timerRef = useRef(null);
  const latestDraftPageRef = useRef(draftPage || page);
  const lastMutationRef = useRef(localPageMutationRef.current);
  const dirtyRef = useRef(false);
  const promptedDraftRef = useRef('');

  latestDraftPageRef.current = draftPage || page;

  const flushDraft = useCallback(() => {
    if (!dirtyRef.current || !isServerPageMode() || !authUser || publicLandingSlug || !canWrite) return null;
    const snapshot = normalizePageForSave(latestDraftPageRef.current || latestPageRef.current || page);
    const savedDraft = savePageDraft({ page: snapshot, authUser });
    if (!savedDraft) {
      markSaveStatus('error', '임시 저장 실패', '브라우저 저장 공간을 확인해주세요.');
      return null;
    }
    dirtyRef.current = false;
    markSaveStatus('info', '임시 저장됨', '서버 저장 전 편집 내용을 이 브라우저에 보관했습니다.');
    return savedDraft;
  }, [authUser, canWrite, latestPageRef, markSaveStatus, page, publicLandingSlug]);

  const clearCurrentDraft = useCallback((savedPage = null) => {
    const targetPage = savedPage || latestPageRef.current || page;
    dirtyRef.current = false;
    promptedDraftRef.current = '';
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    clearPageDraft({ page: targetPage, authUser });
  }, [authUser, latestPageRef, page]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug || !canWrite) return undefined;
    const mutation = Number(localPageMutationRef.current || 0);
    const locallyChanged = mutation !== lastMutationRef.current;
    lastMutationRef.current = mutation;
    if (!locallyChanged && !hasPendingStyle) return undefined;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [draftPage, hasPendingStyle, authUser, canWrite, publicLandingSlug, flushDraft, localPageMutationRef]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug || !canWrite) return undefined;
    const onPageHide = () => flushDraft();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [authUser, canWrite, flushDraft, publicLandingSlug]);

  useEffect(() => {
    if (!accountPageReadyKey || !isServerPageMode() || !authUser || publicLandingSlug || !canWrite) return;
    const serverPage = latestPageRef.current || page;
    const draft = readPageDraft({ page: serverPage, authUser });
    if (!draft) return;
    const identity = pageDraftIdentity(serverPage, authUser);
    const promptKey = `${identity}:${draft.editedAt}`;
    if (promptedDraftRef.current === promptKey) return;
    const evaluation = evaluatePageDraft({ draft, serverPage });
    if (evaluation.action !== 'restore') {
      clearPageDraft({ page: serverPage, authUser });
      return;
    }
    promptedDraftRef.current = promptKey;
    requestConfirm({
      title: '저장하지 않은 편집본이 있습니다.',
      message: `${formatDraftTime(draft.editedAt)}에 이 브라우저에 임시 저장된 내용입니다. 서버에 마지막으로 저장한 페이지 대신 임시 편집본을 복원할까요?`,
      confirmLabel: '임시본 복원',
      onConfirm: () => {
        const restored = restorePageDraft({ draft, serverPage });
        latestPageRef.current = restored;
        localPageMutationRef.current += 1;
        dirtyRef.current = true;
        setPage(restored);
        markSaveStatus('info', '임시본 복원됨', '내용을 확인한 뒤 저장 버튼을 눌러 서버에 반영하세요.');
        showToast('저장하지 않은 임시 편집본을 복원했습니다.', 'success');
      },
      onCancel: () => {
        clearPageDraft({ page: serverPage, authUser });
        dirtyRef.current = false;
        showToast('임시 편집본을 삭제하고 서버 저장본을 유지했습니다.', 'info');
      },
    });
  }, [accountPageReadyKey, authUser, canWrite, latestPageRef, localPageMutationRef, markSaveStatus, page, publicLandingSlug, requestConfirm, setPage, showToast]);

  return { clearCurrentDraft, flushDraft };
}
