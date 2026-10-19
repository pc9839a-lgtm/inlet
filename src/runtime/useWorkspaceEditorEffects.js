import { useEffect } from 'react';

export function useWorkspaceEditorEffects({
  tab,
  page,
  workspaceOpen,
  editInitialCollapseRef,
  setOpenId,
  setAddOpen,
}) {
  useEffect(() => {
    if (!workspaceOpen || tab !== 'edit') return;
    const collapseKey = `${page.projectId || ''}:${page.slug || ''}`;
    if (editInitialCollapseRef.current === collapseKey) return;
    editInitialCollapseRef.current = collapseKey;
    setOpenId('');
    setAddOpen(false);
  }, [editInitialCollapseRef, page.projectId, page.slug, setAddOpen, setOpenId, tab, workspaceOpen]);
}
