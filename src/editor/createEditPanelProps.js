import { createEditPanelRenderers } from './editPanelRenderers.jsx';

export function createEditPanelProps({
  page,
  openId,
  setOpenId,
  addOpen,
  setAddOpen,
  dragId,
  setDragId,
  updateTheme,
  toggleVisible,
  addBlock,
  addSectionPattern,
  removeBlock,
  duplicateBlock,
  reorderToIndex,
  updateBlock,
  authUser,
}) {
  return {
    page,
    openId,
    setOpenId,
    addOpen,
    setAddOpen,
    dragId,
    setDragId,
    updateTheme,
    toggleVisible,
    addBlock,
    addSectionPattern,
    removeBlock,
    duplicateBlock,
    reorderToIndex,
    ...createEditPanelRenderers({ page, updateBlock, authUser }),
  };
}