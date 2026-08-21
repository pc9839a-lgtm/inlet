import React, { useEffect, useMemo, useState } from 'react';
import PanelHeader from '../builder/PanelHeader.jsx';
import { META } from '../config/blockMeta.jsx';
import { WorkspacePreviewPane } from '../screens/workspace/WorkspacePreviewPane.jsx';
import { WorkspaceTabs } from '../screens/workspace/WorkspaceTabs.jsx';
import { createEditPanelSectionProps } from './createEditPanelSectionProps.js';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { SelectedBlockSettingsBody } from './editPanelParts/SelectedBlockSettingsBody.jsx';
import { useEditPanelSelection } from './useEditPanelSelection.jsx';

export default function EditWorkbench({
  page,
  tab,
  saved,
  saveStatus,
  onSave,
  onPreview,
  onDashboard,
  onStartChoice,
  previewUrl,
  allowedTabs,
  changeTab,
  editPanelProps,
  previewPage,
  leads,
  addLead,
  track,
  selectedBlockId,
  onSelectPreviewBlock,
}) {
  const {
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
  } = editPanelProps;

  const selection = useEditPanelSelection({ page, openId, setOpenId, setAddOpen });
  const [inspectorView, setInspectorView] = useState('settings');
  const [settingsTarget, setSettingsTarget] = useState(selection.normalSelectedId ? 'block' : 'page');

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

  const selectedBlock = useMemo(
    () => selection.normalBlocks.find((block) => block.id === selection.normalSelectedId) || null,
    [selection.normalBlocks, selection.normalSelectedId],
  );

  useEffect(() => {
    if (!selection.normalSelectedId) return;
    setSettingsTarget('block');
    setInspectorView('settings');
  }, [selection.normalSelectedId]);

  useEffect(() => {
    if (selectedBlock || settingsTarget !== 'block') return;
    setSettingsTarget('page');
  }, [selectedBlock, settingsTarget]);

  const selectBlock = (blockId) => {
    const closing = selection.normalSelectedId === blockId;
    selection.selectBlock(blockId);
    setSettingsTarget(closing ? 'page' : 'block');
    setInspectorView('settings');
  };

  const showPageOptions = () => {
    if (selection.normalSelectedId) selection.selectBlock(selection.normalSelectedId);
    setSettingsTarget('page');
    setInspectorView('settings');
  };

  const screenOrderListProps = {
    ...sectionProps.screenOrderListProps,
    selectedId: selection.normalSelectedId,
    selectBlock,
    openBlockSettings: selectBlock,
    inlineEditor: false,
  };

  const selectedLabel = selectedBlock
    ? (selectedBlock.type === 'code' && selectedBlock.s?.widgetMode === 'bgm' ? META.bgm.label : (META[selectedBlock.type]?.label || '블록'))
    : '';

  return (
    <div className="builder-shell edit-workbench-shell">
      <header className="edit-workbench-nav">
        <button type="button" className="edit-workbench-brand" onClick={onDashboard}>PAGERO</button>
        <WorkspaceTabs allowedTabs={allowedTabs} tab={tab} changeTab={changeTab} />
      </header>

      <div className="edit-workbench-toolbar">
        <PanelHeader
          page={page}
          tab={tab}
          saved={saved}
          saveStatus={saveStatus}
          onSave={onSave}
          onPreview={onPreview}
          onDashboard={onDashboard}
          onStartChoice={onStartChoice}
          previewUrl={previewUrl}
        />
      </div>

      <div className="edit-workbench-grid">
        <aside className="edit-workbench-library" aria-label="블록 추가">
          <div className="edit-workbench-panel-head">
            <strong>블록</strong>
            <button type="button" onClick={showPageOptions}>페이지</button>
          </div>
          <div className="edit-workbench-library-scroll">
            <AddBlockDock
              {...sectionProps.addBlockDockProps}
              alwaysOpen
            />
          </div>
        </aside>

        <WorkspacePreviewPane
          variant="canvas"
          page={page}
          previewUrl={previewUrl}
          previewPage={previewPage}
          leads={leads}
          addLead={addLead}
          track={track}
          selectedBlockId={selectedBlockId}
          onSelectPreviewBlock={onSelectPreviewBlock}
        />

        <aside className="edit-workbench-inspector" aria-label="편집 설정">
          <div className="edit-workbench-inspector-tabs">
            <button
              type="button"
              className={inspectorView === 'settings' ? 'active' : ''}
              onClick={() => setInspectorView('settings')}
            >
              {settingsTarget === 'block' && selectedBlock ? `${selectedLabel} 설정` : '페이지 옵션'}
            </button>
            <button
              type="button"
              className={inspectorView === 'order' ? 'active' : ''}
              onClick={() => setInspectorView('order')}
            >
              화면 순서
            </button>
          </div>

          <div className="edit-workbench-inspector-scroll edit-layout">
            {inspectorView === 'order' ? (
              <ScreenOrderList {...screenOrderListProps} />
            ) : settingsTarget === 'block' && selectedBlock ? (
              <section className="edit-workbench-selected-card">
                <div className="edit-workbench-selected-head">
                  <div>
                    <span>선택한 블록</span>
                    <strong>{selectedLabel}</strong>
                  </div>
                  <button type="button" onClick={showPageOptions}>페이지 옵션</button>
                </div>
                <SelectedBlockSettingsBody block={selectedBlock} renderBlockEditor={renderBlockEditor} />
              </section>
            ) : (
              <PageGlobalOptions {...sectionProps.pageGlobalOptionsProps} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}