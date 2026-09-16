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
  const [settingsTarget, setSettingsTarget] = useState(selection.normalSelectedId ? 'block' : 'page');
  const [mobilePane, setMobilePane] = useState('blocks');

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
  }, [selection.normalSelectedId]);

  useEffect(() => {
    if (selectedBlock || settingsTarget !== 'block') return;
    setSettingsTarget('page');
  }, [selectedBlock, settingsTarget]);

  const selectBlock = (blockId) => {
    const closing = selection.normalSelectedId === blockId;
    selection.selectBlock(blockId);
    setSettingsTarget(closing ? 'page' : 'block');
    setMobilePane(closing ? 'blocks' : 'settings');
  };

  const showPageOptions = () => {
    if (selection.normalSelectedId) selection.selectBlock(selection.normalSelectedId);
    setSettingsTarget('page');
    setMobilePane('settings');
  };

  const screenOrderListProps = {
    ...sectionProps.screenOrderListProps,
    selectedId: selection.normalSelectedId,
    selectBlock,
    openBlockSettings: selectBlock,
    inlineEditor: false,
  };

  const selectedLabel = selectedBlock ? (META[selectedBlock.type]?.label || '블록') : '';

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

      <div className="edit-workbench-grid" data-mobile-pane={mobilePane}>
        <div className="edit-workbench-mobile-tabs" role="tablist" aria-label="모바일 편집 화면">
          <button type="button" role="tab" aria-selected={mobilePane === 'blocks'} className={mobilePane === 'blocks' ? 'active' : ''} onClick={() => setMobilePane('blocks')}>블록</button>
          <button type="button" role="tab" aria-selected={mobilePane === 'settings'} className={mobilePane === 'settings' ? 'active' : ''} onClick={() => setMobilePane('settings')}>설정</button>
          <button type="button" role="tab" aria-selected={mobilePane === 'preview'} className={mobilePane === 'preview' ? 'active' : ''} onClick={() => setMobilePane('preview')}>미리보기</button>
        </div>

        <aside className="edit-workbench-sidebar" aria-label="화면 순서 및 편집 설정">
          <div className="edit-workbench-sidebar-scroll edit-layout">
            <section className="edit-workbench-order-pane">
              <div className="edit-workbench-section-head">
                <strong>화면 순서</strong>
                <button type="button" className={settingsTarget === 'page' ? 'active' : ''} onClick={showPageOptions}>페이지 옵션</button>
              </div>
              <ScreenOrderList {...screenOrderListProps} />
            </section>

            <section className="edit-workbench-settings-pane">
              {settingsTarget === 'block' && selectedBlock ? (
                <div className="edit-workbench-selected-card">
                  <div className="edit-workbench-selected-head">
                    <div>
                      <span>선택한 블록</span>
                      <strong>{selectedLabel}</strong>
                    </div>
                    <button type="button" onClick={showPageOptions}>페이지 옵션</button>
                  </div>
                  <SelectedBlockSettingsBody block={selectedBlock} renderBlockEditor={renderBlockEditor} />
                </div>
              ) : (
                <PageGlobalOptions {...sectionProps.pageGlobalOptionsProps} />
              )}
            </section>
          </div>

          <div className="edit-workbench-sidebar-footer">
            <AddBlockDock {...sectionProps.addBlockDockProps} />
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
      </div>
    </div>
  );
}
