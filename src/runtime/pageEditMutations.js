export function createPageEditMutations({ tab, blockWrite, setPage, commitLocalPageDraft, normalizeIntegrations, normalizeFreeEmailIntegrations }) {
  const setNormalizedPage = (updater) => {
    if (blockWrite(tab)) return;
    setPage((prev) => commitLocalPageDraft(typeof updater === 'function' ? updater(prev) : updater));
  };
  const updatePage = (patch) => {
    if (blockWrite(tab)) return;
    setPage((p) => commitLocalPageDraft({ ...p, ...patch }));
  };
  const updateTheme = (patch) => {
    if (blockWrite('style')) return;
    setPage((p) => commitLocalPageDraft({ ...p, theme: { ...p.theme, ...patch } }));
  };
  const updateStyleBlocks = (blocks) => {
    if (blockWrite('style')) return;
    setPage((p) => commitLocalPageDraft({ ...p, blocks: Array.isArray(blocks) ? blocks : p.blocks }));
  };
  const updateMeta = (patch) => {
    if (blockWrite('settings')) return;
    setPage((p) => commitLocalPageDraft({ ...p, meta: { ...p.meta, ...patch } }));
  };
  const updateAi = (patch) => {
    if (blockWrite('admin')) return;
    setPage((p) => commitLocalPageDraft({ ...p, ai: { ...(p.ai || {}), ...patch } }));
  };
  const updateIntegrations = (section, patch) => {
    if (blockWrite(tab === 'inbox' ? 'inbox' : 'settings')) return;
    setPage((p) => commitLocalPageDraft(normalizeFreeEmailIntegrations({
      ...p,
      integrations: normalizeIntegrations({
        ...(p.integrations || {}),
        [section]: { ...(p.integrations?.[section] || {}), ...patch },
      }),
    })));
  };
  return { setNormalizedPage, updatePage, updateTheme, updateStyleBlocks, updateMeta, updateAi, updateIntegrations };
}
