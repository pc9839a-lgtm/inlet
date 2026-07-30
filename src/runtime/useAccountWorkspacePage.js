import { useLayoutEffect } from 'react';
import { fetchServerPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { defaultPage, normalize, normalizePageForSave } from '../lib/pageModel.js';
import { hasAccountProjectAccess } from '../lib/accountProjectAccess.js';

export function useAccountWorkspacePage({
  publicLandingSlug,
  authUser,
  page,
  setPage,
  accountPageLoadRef,
  latestPageRef,
  localPageMutationRef,
  setAccountPageReadyKey,
}) {
  useLayoutEffect(() => {
    if (publicLandingSlug || !authUser) {
      setAccountPageReadyKey?.('');
      return undefined;
    }
    let alive = true;
    const slug = page.slug || defaultPage.slug || 'my-page';
    const context = projectContext(page, authUser);
    const pageOwnerId = String(page.ownerId || page.ownerAccountId || '').trim();
    const pageProjectId = String(page.projectId || '').trim();
    const accountProjectAccess = hasAccountProjectAccess(page);
    const belongsToAccount = accountProjectAccess || ((!pageOwnerId || pageOwnerId === context.ownerId)
      && (!pageProjectId || pageProjectId === context.projectId || pageProjectId === context.legacyProjectId));
    if (!belongsToAccount) {
      const isolatedPage = normalizePageForSave({
        ...defaultPage,
        slug,
        projectId: context.projectId,
        ownerId: context.ownerId,
      });
      latestPageRef.current = isolatedPage;
      setPage(isolatedPage);
    }
    const loadKey = `${context.projectId}:${context.slug}:${authUser?.session || authUser?.workspaceId || authUser?.email || ''}`;
    const loadMutation = localPageMutationRef.current;
    if (accountPageLoadRef.current === loadKey) return undefined;
    accountPageLoadRef.current = loadKey;
    setAccountPageReadyKey?.('');
    fetchServerPage(slug, context)
      .then((serverPage) => {
        if (!alive) return;
        if (accountPageLoadRef.current !== loadKey) return;
        if (localPageMutationRef.current !== loadMutation) return;
        if (serverPage) {
          setPage((current) => {
            if ((current.slug || '') !== slug || (current.projectId || '') !== (context.projectId || '')) return current;
            const nextPage = normalize({ ...serverPage, __accountProjectAccess: accountProjectAccess });
            latestPageRef.current = nextPage;
            return nextPage;
          });
          return;
        }
        setPage((current) => {
          const currentSlug = current.slug || slug;
          const nextContext = projectContext({ ...current, slug: currentSlug }, authUser);
          if (current.slug === currentSlug && current.projectId === nextContext.projectId && current.ownerId === nextContext.ownerId) return current;
          return normalizePageForSave({
            ...current,
            slug: currentSlug,
            projectId: nextContext.projectId,
            ownerId: nextContext.ownerId,
          });
        });
      })
      .catch((error) => {
        console.warn('Server page load failed:', error);
      })
      .finally(() => {
        if (!alive) return;
        if (accountPageLoadRef.current !== loadKey) return;
        setAccountPageReadyKey?.(loadKey);
      });
    return () => { alive = false; };
  }, [publicLandingSlug, authUser?.session, authUser?.workspaceId, authUser?.email, page.slug, page.projectId, page.ownerId]);
}
