import { STORAGE_KEY } from '../config/storageKeys.js';
import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { attachExistingPageIdentity } from './savePageIdentity.js';

export function usePageSaveAction({
  allowedTabs,
  tab,
  canWriteCurrentTab,
  hasPendingStyle,
  page,
  authUser,
  latestPageRef,
  requestConfirm,
  persistStyleNow,
  pageForAccountSave,
  savedPageFromResult,
  handlePageSaveError,
  markSaveStatus,
  saveLocalJson,
  showToast,
  setConnectionsEditing,
  setPage,
  setSaved,
}) {
  const saveNow = async (pageOverride = null) => {
    if (!allowedTabs.includes(tab)) {
      markSaveStatus('warning', '저장 차단', '현재 권한에서 저장할 수 없는 화면입니다.');
      return { ok: false, reason: 'tab-blocked' };
    }
    if (!canWriteCurrentTab) {
      markSaveStatus('warning', '권한 없음', '마스터가 부여한 쓰기 권한이 필요합니다.');
      showToast('현재 계정에는 이 화면을 저장할 권한이 없습니다.', 'warning');
      return { ok: false, reason: 'write-blocked' };
    }
    if (tab === 'style' && hasPendingStyle) {
      requestConfirm({
        title: '스타일 설정을 저장할까요?',
        message: '현재 미리보기 중인 스타일 값이 실제 페이지에 적용됩니다.',
        confirmLabel: '저장',
        onConfirm: persistStyleNow,
      });
      return { ok: false, reason: 'style-confirm-required' };
    }

    const sourcePage = pageOverride
      ? normalizePageForSave({ ...(latestPageRef.current || page), ...pageOverride })
      : (latestPageRef.current || page);
    const saveSourcePage = await attachExistingPageIdentity(sourcePage, {
      authUser,
      latestPage: latestPageRef.current,
      currentPage: page,
    });
    const expectedUpdatedAt = saveSourcePage.updatedAt || saveSourcePage.savedAt || saveSourcePage.createdAt || sourcePage.updatedAt || sourcePage.savedAt || sourcePage.createdAt || '';
    const nextPage = pageForAccountSave(saveSourcePage);
    let result = null;
    try {
      result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, saveMode: 'update-existing' });
    } catch (error) {
      const handled = await handlePageSaveError(error, nextPage);
      markSaveStatus(handled ? 'warning' : 'error', handled ? '저장 충돌' : '서버 저장 실패', handled
        ? '다른 곳에서 먼저 저장된 페이지가 있어 확인이 필요합니다.'
        : `로컬에는 남았지만 서버 저장에 실패했습니다. ${String(error?.message || error)}`);
      if (!handled) showToast(`서버 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
      return { ok: false, error };
    }
    setConnectionsEditing(false);
    const savedPage = result?.page ? savedPageFromResult(nextPage, result.page) : nextPage;
    latestPageRef.current = savedPage;
    setPage(savedPage);
    saveLocalJson(STORAGE_KEY, savedPage, '페이지');
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
    const saveModeLabel = result?.mode === 'local' ? '로컬 저장됨' : '서버 저장됨';
    const saveModeDetail = result?.mode === 'local' ? '페이지가 브라우저에 저장되었습니다.' : '페이지가 서버에 저장되었습니다.';
    markSaveStatus('ok', saveModeLabel, saveModeDetail);
    return { ok: true, page: savedPage, result };
  };

  return { saveNow };
}