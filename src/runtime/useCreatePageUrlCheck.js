import { isServerPageMode } from '../config/runtimeConfig.js';
import { fetchPublicServerPage, fetchServerPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { pageSlugIssues, sanitizePageSlug } from '../lib/pageSlugs.js';

export function useCreatePageUrlCheck({ page, authUser }) {
  const checkCreatePageUrl = async ({ slug } = {}) => {
    const safeSlug = sanitizePageSlug(slug, '');
    const issues = pageSlugIssues(safeSlug);
    if (issues.length) return { ok: false, slug: safeSlug, message: issues[0] };
    if (safeSlug === sanitizePageSlug(page.slug || '', '')) {
      return { ok: true, slug: safeSlug, message: '현재 페이지 주소를 그대로 사용합니다.' };
    }
    if (!isServerPageMode()) return { ok: true, slug: safeSlug };
    const context = projectContext({ ...page, slug: safeSlug }, authUser);
    try {
      const publicExisting = await fetchPublicServerPage(safeSlug);
      const currentPageId = String(page.id || '').trim();
      const currentProjectId = String(page.projectId || '').trim();
      const publicPageId = String(publicExisting?.id || '').trim();
      const publicProjectId = String(publicExisting?.projectId || '').trim();
      const publicIsCurrentPage = !!publicExisting && ((currentPageId && publicPageId === currentPageId) || (currentProjectId && publicProjectId === currentProjectId));
      if (publicExisting && !publicIsCurrentPage && publicProjectId !== String(context.projectId || '')) {
        return { ok: false, slug: safeSlug, message: '이미 사용 중인 URL입니다. 다른 URL을 입력해주세요.' };
      }
      const existing = await fetchServerPage(safeSlug, context);
      if (existing) return { ok: false, slug: safeSlug, message: '이미 사용 중인 URL입니다. 다른 URL을 입력해주세요.' };
      return { ok: true, slug: safeSlug };
    } catch (error) {
      console.warn('Page URL availability check failed:', error);
      return {
        ok: true,
        slug: safeSlug,
        warning: true,
        message: '서버 중복 확인이 불안정합니다. 저장 단계에서 다시 확인합니다.',
      };
    }
  };

  return { checkCreatePageUrl };
}