import React from 'react';
import { META } from '../config/blockMeta.jsx';
import { createEditPanelSectionProps } from './createEditPanelSectionProps.js';
import { EditPanelLayout } from './EditPanelLayout.jsx';
import { EditorMediaLibraryProvider } from './EditorMediaLibraryContext.jsx';
import { useEditPanelSelection } from './useEditPanelSelection.jsx';

export default function EditPanel({
  page,
  authUser = null,
  stylePanelProps = null,
  openId,
  setOpenId,
  addOpen,
  setAddOpen,
  dragId,
  setDragId,
  updatePage,
  updateTheme,
  toggleVisible,
  addBlock,
  removeBlock,
  duplicateBlock,
  reorderToIndex,
  renderTopNavEditor,
  renderBottomBarEditor,
  renderFooterEditor,
  renderBlockEditor,
}) {
  const selection = useEditPanelSelection({ page, openId, setOpenId, setAddOpen });
  const sectionProps = createEditPanelSectionProps({
    page,
    selection,
    dragId,
    setDragId,
    updatePage,
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
  });
  const selectedBlock = selection.normalBlocks.find((block) => block.id === selection.normalSelectedId) || null;
  const selectedMetaType = selectedBlock?.s?.widgetMode === 'youtube' ? 'youtube' : selectedBlock?.type;
  const selectedMeta = selectedBlock ? (META[selectedMetaType] || META.text) : null;
  const selectedBlockSettingsProps = selectedBlock
    ? { block: selectedBlock, meta: selectedMeta, renderBlockEditor }
    : null;

  return (
    <EditorMediaLibraryProvider page={page} authUser={authUser}>
      <EditPanelLayout
        {...sectionProps}
        selectedBlockSettingsProps={selectedBlockSettingsProps}
        stylePanelProps={stylePanelProps}
      />
    </EditorMediaLibraryProvider>
  );
}