export function createScreenOrderListProps({ selection, dragId, setDragId, toggleVisible, duplicateBlock, removeBlock, reorderToIndex, renderBlockEditor }) {
  return {
    normalBlocks: selection.normalBlocks,
    selectedId: selection.normalSelectedId,
    dragId,
    setDragId,
    selectBlock: selection.selectBlock,
    openBlockSettings: selection.openBlockSettings,
    toggleVisible,
    duplicateBlock,
    removeBlock,
    reorderToIndex,
    renderBlockEditor,
  };
}