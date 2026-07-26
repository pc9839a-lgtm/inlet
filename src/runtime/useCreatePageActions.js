import { START_MODE_KEY, STORAGE_KEY } from '../config/storageKeys.js';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { persistPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { sanitizePageSlug } from '../lib/pageSlugs.js';
import { defaultPage, normalizePageForSave, uid } from '../lib/pageModel.js';
import { normalizeAiDraftInput } from '../ai/aiDraftSchema.js';

export function useCreatePageActions({
  page,
  authUser,
  canManageAdmin,
  canUseBuilder,
  loadTemplateModule,
  savedPageFromResult,
  saveLocalJson,
  showToast,
  setPage,
  setCreateOpen,
  setStartMode,
  setTab,
  setOpenId,
  openWorkspace,
}) {
  const saveCreatedPageToServer = async (nextPage, label = '페이지') => {
    const safePage = normalizePageForSave(nextPage);
    saveLocalJson(STORAGE_KEY, safePage, label);
    if (!isServerPageMode()) return { ok: true, mode: 'local' };
    try {
      const result = await persistPage(safePage, authUser, { tab: 'edit' });
      if (result?.page) {
        const savedPage = savedPageFromResult(safePage, result.page);
        saveLocalJson(STORAGE_KEY, savedPage, label, { quietSuccess: true });
        return { ...result, page: savedPage };
      }
      return result;
    } catch (error) {
      showToast(`서버 저장에 실패했습니다. 공개 URL에 표시되지 않습니다. ${String(error?.message || error)}`, 'error');
      throw error;
    }
  };

  const freshCreatedPage = (nextPage, context) => normalizePageForSave({
    ...nextPage,
    id: uid(),
    projectId: context.projectId,
    ownerId: context.ownerId,
  });

  const createWithAi = async (draftInput = null) => {
    if (!canManageAdmin) return;
    const requestedSlug = sanitizePageSlug(draftInput?.slug || defaultPage.slug || 'my-page', 'my-page');
    const nextContext = projectContext({ slug: requestedSlug }, authUser);
    if (draftInput && typeof draftInput === 'object') {
      const nextInput = normalizeAiDraftInput({
        ...(defaultPage.ai?.draftInput || {}),
        ...draftInput,
        slug: requestedSlug,
      });
      const nextPage = freshCreatedPage({
        ...defaultPage,
        slug: requestedSlug,
        ai: {
          ...(defaultPage.ai || {}),
          draftInput: nextInput,
          updatedAt: new Date().toISOString(),
        },
      }, nextContext);
      const saved = await saveCreatedPageToServer(nextPage, '페이지');
      setPage(saved?.page || nextPage);
    }
    setCreateOpen(false);
    saveLocalJson(START_MODE_KEY, 'ai', '시작 선택', { quietSuccess: true });
    setStartMode('ai');
    if (typeof location !== 'undefined') {
      location.href = `/${requestedSlug || 'my-page'}/admin`;
      return;
    }
    openWorkspace('manual');
  };

  const createManual = async (footerInfo = {}) => {
    if (!canManageAdmin) return;
    const nextSlug = sanitizePageSlug(footerInfo?.slug || defaultPage.slug || 'my-page', 'my-page');
    const nextContext = projectContext({ slug: nextSlug }, authUser);
    const basePage = normalizePageForSave({ ...defaultPage, slug: nextSlug });
    let nextPage = null;
    if (footerInfo && Object.keys(footerInfo).length) {
      const { slug: _slug, ...safeFooterInfo } = footerInfo || {};
      nextPage = freshCreatedPage({
        ...basePage,
        slug: nextSlug,
        blocks: basePage.blocks.map((block) => (
          block.type === 'footer'
            ? { ...block, s: { ...block.s, ...safeFooterInfo } }
            : block
        )),
      }, nextContext);
    } else {
      nextPage = freshCreatedPage({
        ...basePage,
        slug: nextSlug,
      }, nextContext);
    }
    if (nextPage) {
      const saved = await saveCreatedPageToServer(nextPage, '페이지');
      setPage(saved?.page || nextPage);
    }
    setCreateOpen(false);
    saveLocalJson(START_MODE_KEY, 'manual', '시작 선택', { quietSuccess: true });
    setStartMode('manual');
    setTab('edit');
    openWorkspace('manual');
  };

  const createFromTemplate = async (templateId, urlConfig = {}) => {
    if (!canUseBuilder) return;
    try {
      const templates = await loadTemplateModule();
      const templatePage = templates.createTemplatePage(templateId, defaultPage);
      const nextSlug = sanitizePageSlug(urlConfig?.slug || templatePage.slug || defaultPage.slug || 'my-page', 'my-page');
      const templateContext = projectContext({ slug: nextSlug }, authUser);
      const next = freshCreatedPage({
        ...templatePage,
        slug: nextSlug,
      }, templateContext);
      const saved = await saveCreatedPageToServer(next, '페이지');
      setPage(saved?.page || next);
      saveLocalJson(START_MODE_KEY, 'manual', '시작 선택', { quietSuccess: true });
      setStartMode('manual');
      setTab('edit');
      setOpenId('');
      setCreateOpen(false);
      openWorkspace('manual');
    } catch (error) {
      console.warn('Template apply failed:', error);
      showToast(`템플릿 적용에 실패했습니다. ${String(error?.message || error)}`, 'error');
    }
  };

  return {
    createWithAi,
    createManual,
    createFromTemplate,
  };
}