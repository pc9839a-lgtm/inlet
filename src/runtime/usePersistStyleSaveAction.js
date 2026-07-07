import { STORAGE_KEY } from '../config/storageKeys.js';
import { persistPage } from '../lib/pageRepository.js';
import { attachExistingPageIdentity } from './savePageIdentity.js';

export function usePersistStyleSaveAction({
  page,
  authUser,
  latestPageRef,
  stylePreviewTheme,
  stylePreviewBlocks,
  blockWrite,
  pageForAccountSave,
  savedPageFromResult,
  handlePageSaveError,
  markSaveStatus,
  saveLocalJson,
  showToast,
  setPage,
  setStylePreviewTheme,
  setStylePreviewBlocks,
  setConnectionsEditing,
  setSaved,
}) {
  const persistStyleNow = async () => {
    if (blockWrite('style')) return;
    const basePage = latestPageRef.current || page;
    const styleSourcePage = await attachExistingPageIdentity({
      ...basePage,
      theme: stylePreviewTheme ? { ...basePage.theme, ...stylePreviewTheme } : basePage.theme,
      blocks: stylePreviewBlocks || basePage.blocks,
    }, {
      authUser,
      latestPage: latestPageRef.current,
      currentPage: page,
    });
    const nextPage = pageForAccountSave(styleSourcePage);
    const expectedUpdatedAt = styleSourcePage.updatedAt || styleSourcePage.savedAt || styleSourcePage.createdAt || page.updatedAt || page.savedAt || page.createdAt || '';
    latestPageRef.current = nextPage;
    setPage(nextPage);
    saveLocalJson(STORAGE_KEY, nextPage, '페이지');
    let result = null;
    try {
      result = await persistPage(nextPage, authUser, { tab: 'style', expectedUpdatedAt, saveMode: 'update-existing' });
    } catch (error) {
      const handled = await handlePageSaveError(error, nextPage);
      markSaveStatus(handled ? 'warning' : 'error', handled ? '저장 충돌' : '서버 저장 실패', handled
        ? '다른 곳에서 먼저 저장된 페이지가 있어 확인이 필요합니다.'
        : `로컬에는 남았지만 서버 저장에 실패했습니다. ${String(error?.message || error)}`);
      if (!handled) showToast(`서버 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
      return;
    }
    setStylePreviewTheme(null);
    setStylePreviewBlocks(null);
    setConnectionsEditing(false);
    if (result?.page) {
      const savedPage = savedPageFromResult(nextPage, result.page);
      latestPageRef.current = savedPage;
      setPage(savedPage);
      saveLocalJson(STORAGE_KEY, savedPage, '페이지');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
    const saveModeLabel = result?.mode === 'local' ? '로컬 저장됨' : '서버 저장됨';
    const saveModeDetail = result?.mode === 'local' ? '스타일과 페이지가 브라우저에 저장되었습니다.' : '스타일과 페이지가 서버에 저장되었습니다.';
    markSaveStatus('ok', saveModeLabel, saveModeDetail);
    showToast('스타일 설정이 저장되었습니다.', 'success');
  };

  return { persistStyleNow };
}