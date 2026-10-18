import { useEffect } from 'react';

export function useWorkspaceEditorEffects({
  tab,
  page,
  workspaceOpen,
  editInitialCollapseRef,
  setStylePreviewTheme,
  setOpenId,
  setAddOpen,
}) {
  // Preserve the staged theme while switching between '페이지 옵션' and
  // '화면 순서'. Reset it only when opening a different page.
  useEffect(() => {
    setStylePreviewTheme(null);
  }, [page.projectId, page.slug, setStylePreviewTheme]);

  // After leaving the editor for operational tabs there is no mounted style
  // inspector. Do not let an old clean preview theme become a new unsaved
  // change when a server revision is restored in Settings.
  useEffect(() => {
    if (tab !== 'edit' && tab !== 'style') setStylePreviewTheme(null);
  }, [tab, setStylePreviewTheme]);

  useEffect(() => {
    if (!workspaceOpen || tab !== 'edit') return;
    const collapseKey = `${page.projectId || ''}:${page.slug || ''}`;
    if (editInitialCollapseRef.current === collapseKey) return;
    editInitialCollapseRef.current = collapseKey;
    setOpenId('');
    setAddOpen(false);
  }, [editInitialCollapseRef, page.projectId, page.slug, setAddOpen, setOpenId, tab, workspaceOpen]);
}
