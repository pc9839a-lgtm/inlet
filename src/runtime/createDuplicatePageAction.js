export function createDuplicatePageAction({
  page,
  blockWrite,
  canUsePageDuplication,
  createDuplicatedPage,
  latestPageRef,
  markLocalPageMutation,
  setPage,
  setLeads,
  setEvents,
  setOpenId,
  setTab,
  replaceLocationTab,
  tabKeys,
  saveLocalJson,
  startModeKey,
  showToast,
}) {
  return function duplicatePageWithUrl(urlConfig) {
    if (blockWrite('settings')) {
      return { ok: false, message: '\uC124\uC815 \uD3B8\uC9D1 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' };
    }
    if (!canUsePageDuplication(page)) {
      return { ok: false, locked: true, message: '\uD398\uC774\uC9C0 \uBCF5\uC81C\uB294 \uC720\uB8CC \uAE30\uB2A5\uC785\uB2C8\uB2E4. \uACB0\uC81C \uC5F0\uB3D9 \uD6C4 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.' };
    }
    const nextPage = createDuplicatedPage(page, urlConfig);
    latestPageRef.current = nextPage;
    markLocalPageMutation();
    setPage(nextPage);
    setLeads([]);
    setEvents([]);
    setOpenId('');
    setTab('edit');
    replaceLocationTab(tabKeys, 'edit');
    saveLocalJson(startModeKey, 'manual', '\uC2DC\uC791 \uBC29\uC2DD', { quietSuccess: true });
    showToast(`\uD398\uC774\uC9C0\uB97C \uBCF5\uC81C\uD588\uC2B5\uB2C8\uB2E4. \uC0C8 URL: /${nextPage.slug}`, 'success');
    return { ok: true, page: nextPage };
  };
}
