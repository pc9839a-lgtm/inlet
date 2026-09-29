import React from 'react';
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
  addSectionPattern,
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
    addSectionPattern,
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

  return (
    <EditorMediaLibraryProvider page={page} authUser={authUser}>
      <EditPanelLayout
        {...sectionProps}
        stylePanelProps={stylePanelProps}
      />
    </EditorMediaLibraryProvider>
  );
}