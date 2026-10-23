import React from 'react';
import './EditPanelLayout.css';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { CompositionDrawer } from './editPanelParts/CompositionDrawer.jsx';
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
  const [compositionOpen, setCompositionOpen] = React.useState(false);
  const compositionButton = React.useRef(null);
  const compositionDialog = React.useRef(null);
  const selectedBlockId = fixedBlocksProps?.openId || screenOrderListProps?.selectedId;
  const fixedSelected = createFixedBlockDescriptors(fixedBlocksProps).find((item) => item.open);
  const closeComposition = () => { compositionDialog.current?.close(); setCompositionOpen(false); };
  const chooseBlock = (id) => {
    if (screenOrderListProps.selectedId !== id) screenOrderListProps.selectBlock(id);
    setSection('order');
    closeComposition();
  };
  const chooseFixed = (id) => {
    if (fixedBlocksProps.openId !== id) fixedBlocksProps.toggleBlockOpen(id);
    setSection('order');
    closeComposition();
  };

  React.useEffect(() => {
    if (selectedBlockId) setSection('order');
    if (selectedBlockId) closeComposition();
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
    <div className="edit-layout">
      <nav
        className="edit-section-tabs"
        data-pagero-ui="edit-section-tabs-v2"
        aria-label="편집 영역 선택"
      >
        <button
          className="edit-section-tab"
          data-selected={section === 'order' ? 'true' : 'false'}
          type="button"
          aria-pressed={section === 'order'}
          ref={compositionButton}
          aria-haspopup="dialog"
          aria-expanded={compositionOpen}
          onClick={() => setCompositionOpen(true)}
        >
          구성
        </button>
        <button
          className="edit-section-tab"
          data-selected={section === 'options' ? 'true' : 'false'}
          type="button"
          aria-pressed={section === 'options'}
          onClick={openPageOptions}
        >
          페이지 설정{stylePanelProps?.hasPendingStyle ? ' · 미적용' : ''}
        </button>
      </nav>

      <div className="edit-section-panel" data-editor-section={section}>
        {section === 'options' ? (
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
            {fixedSelected ? <ScreenOrderSettings block={fixedSelected.block} identity={{ customLabel: fixedSelected.title }} onBack={() => setCompositionOpen(true)} renderBlockEditor={fixedSelected.renderEditor} />
              : <ScreenOrderList {...screenOrderListProps} inspectorOnly onRequestList={() => setCompositionOpen(true)} />}
            {!selectedBlockId && <div className="editor-selection-empty"><h2>선택한 항목 없음</h2><button type="button" onClick={() => setCompositionOpen(true)}>구성 열기</button></div>}
          </>
        )}
      </div>

      <CompositionDrawer dialogRef={compositionDialog} open={compositionOpen} onClose={closeComposition}>
        <ScreenOrderList {...screenOrderListProps} listOnly selectBlock={chooseBlock} />
        <section className="screen-order-fixed-blocks" aria-label="고정 영역">
          <h3>고정 영역</h3>
          <GlobalFixedBlocks {...fixedBlocksProps} openId="" toggleBlockOpen={chooseFixed} />
        </section>
        <AddBlockDock {...addBlockDockProps} />
      </CompositionDrawer>
    </div>
  );
}
