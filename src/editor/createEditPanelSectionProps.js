import { createAddBlockDockProps } from './editPanelSectionProps/addBlockDockProps.js';
import { createPageGlobalOptionsProps } from './editPanelSectionProps/pageGlobalOptionsProps.js';
import { createScreenOrderListProps } from './editPanelSectionProps/screenOrderListProps.js';
import { createSelectedBlockSettingsProps } from './editPanelSectionProps/selectedBlockSettingsProps.js';

export function createEditPanelSectionProps({
  page,
  selection,
  dragId,
  setDragId,
  updateTheme,
  toggleVisible,
  addBlock,
  removeBlock,
  duplicateBlock,
  reorderToIndex,
  addOpen,
  setAddOpen,
  openId,
  renderTopNavEditor,
  renderBottomBarEditor,
  renderFooterEditor,
  renderBlockEditor,
}) {
  return {
    pageGlobalOptionsProps: createPageGlobalOptionsProps({
      page,
      selection,
      updateTheme,
      toggleVisible,
      renderTopNavEditor,
      renderBottomBarEditor,
      renderFooterEditor,
    }),
    screenOrderListProps: createScreenOrderListProps({
      selection,
      dragId,
      setDragId,
      toggleVisible,
      duplicateBlock,
      removeBlock,
      reorderToIndex,
    }),
    selectedBlockSettingsProps: createSelectedBlockSettingsProps({
      selection,
      renderBlockEditor,
    }),
    addBlockDockProps: createAddBlockDockProps({
      addOpen,
      setAddOpen,
      openId,
      addBlock,
    }),
  };
}