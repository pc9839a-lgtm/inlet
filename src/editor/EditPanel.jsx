import React from 'react';
import { createEditPanelSectionProps } from './createEditPanelSectionProps.js';
import { EditPanelLayout } from './EditPanelLayout.jsx';
import { useEditPanelSelection } from './useEditPanelSelection.jsx';

export default function EditPanel({
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

  return (
    <EditPanelLayout
      {...sectionProps}
      selectedSettingsRef={selection.selectedSettingsRef}
    />
  );
}