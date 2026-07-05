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
    removeBlock,
    duplicateBlock,
    reorderToIndex,
    ...createEditPanelRenderers({ page, updateBlock, authUser }),
  };
}