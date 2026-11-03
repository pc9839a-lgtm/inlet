import React from 'react';
import { Settings2 } from 'lucide-react';
import { BlockNavigatorSearch } from './editPanelParts/BlockNavigatorSearch.jsx';
import './EditPanelLayout.css';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { createFixedBlockDescriptors } from './editPanelParts/fixedBlockDescriptors.js';
import { ScreenOrderSettings } from './editPanelParts/ScreenOrderSettings.jsx';

const PageThemeStylePanel = React.lazy(() => import('../panels/StylePanel.jsx'));

export function EditPanelLayout({
  pageGlobalOptionsProps,
  fixedBlocksProps,
  screenOrderListProps,
  addBlockDockProps,
  stylePanelProps,
}) {
  const [section, setSection] = React.useState('order');
  const selectedBlockId = fixedBlocksProps?.openId || screenOrderListProps?.selectedId;
  // A blank selection is page-level context, not a reason to collapse the editor.
  // Show the existing page design and options until a block is selected.
  const showPageOptions = section === 'options' || !selectedBlockId;
  const fixedSelected = createFixedBlockDescriptors(fixedBlocksProps).find((item) => item.open);
  const chooseBlock = (id) => {
    if (screenOrderListProps.selectedId !== id) screenOrderListProps.selectBlock(id);
    setSection('order');
  };
  const chooseFixed = (id) => {
    if (fixedBlocksProps.openId !== id) fixedBlocksProps.toggleBlockOpen(id);
    setSection('order');
  };

  React.useEffect(() => {
    if (selectedBlockId) setSection('order');
  }, [selectedBlockId]);

  const openPageOptions = () => {
    if (screenOrderListProps?.selectedId) screenOrderListProps.selectBlock(screenOrderListProps.selectedId);
    else if (fixedBlocksProps?.openId) fixedBlocksProps.toggleBlockOpen(fixedBlocksProps.openId);
    setSection('options');
  };

  const pageTheme = stylePanelProps?.stagedTheme || pageGlobalOptionsProps.page.theme;
  const updatePageTheme = (patch) => {
    if (stylePanelProps?.onPreviewThemeChange) {
      stylePanelProps.onPreviewThemeChange({ ...pageTheme, ...patch });
    } else {
      pageGlobalOptionsProps.updateTheme(patch);
    }
  };

  // D05: row selection must not auto-scroll the outer editor. An explicit
  // preview-to-editor click is handled by useWorkspaceShellActions.

  return (
    <div className="edit-layout" data-editor-layout="left-persistent">
      <aside className="editor-composition-panel" aria-label="구성">
        <div className="editor-composition-heading">
          <h2>블록</h2>
          <AddBlockDock {...addBlockDockProps} compact />
          <button
            className="editor-page-settings-button"
            type="button"
            aria-pressed={showPageOptions}
            aria-controls="editor-selection-panel"
            onClick={openPageOptions}
            title={stylePanelProps?.hasPendingStyle ? '페이지 설정 · 미적용' : '페이지 설정'}
          >
            <Settings2 size={15} aria-hidden="true" />
            <span>페이지 설정</span>
            {stylePanelProps?.hasPendingStyle && (
              <>
                <span className="editor-settings-pending" aria-hidden="true" />
                <span className="editor-visually-hidden"> · 미적용</span>
              </>
            )}
          </button>
        </div>
        <BlockNavigatorSearch blocks={screenOrderListProps.normalBlocks} onSelect={chooseBlock} />
        <div className="editor-composition-content">
          <section className="screen-order-fixed-blocks" aria-label="상단 고정 영역">
            <h3>상단 고정</h3>
            <GlobalFixedBlocks {...fixedBlocksProps} only={['topnav']} compositionRow selectedId={fixedBlocksProps.openId} openId="" toggleBlockOpen={chooseFixed} />
          </section>
          <ScreenOrderList {...screenOrderListProps} listOnly selectBlock={chooseBlock} />
          <section className="screen-order-fixed-blocks" aria-label="하단 고정 영역">
            <h3>하단 고정</h3>
            <GlobalFixedBlocks {...fixedBlocksProps} only={['bottom', 'footer']} compositionRow selectedId={fixedBlocksProps.openId} openId="" toggleBlockOpen={chooseFixed} />
          </section>
        </div>
      </aside>
      <section className="editor-inspector-panel" role="region" aria-label="선택 항목 편집" tabIndex={0}>
      <div id="editor-selection-panel" className="edit-section-panel" data-editor-section={showPageOptions ? 'options' : section}>
        {showPageOptions ? (
          <div className="editor-page-options-stack">
            {stylePanelProps && (
              <React.Suspense fallback={<div className="editor-inspector-loading">불러오는 중</div>}>
                <PageThemeStylePanel {...stylePanelProps} />
              </React.Suspense>
            )}
            <PageGlobalOptions {...pageGlobalOptionsProps} page={{ ...pageGlobalOptionsProps.page, theme: pageTheme }} updateTheme={updatePageTheme} />
          </div>
        ) : (
          <>
            {fixedSelected ? <ScreenOrderSettings block={fixedSelected.block} identity={{ customLabel: fixedSelected.title }} renderBlockEditor={fixedSelected.renderEditor} />
              : <ScreenOrderList {...screenOrderListProps} inspectorOnly />}
          </>
        )}
      </div>

      </section>
    </div>
  );
}
