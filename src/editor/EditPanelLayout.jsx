import React from 'react';
import { createPortal } from 'react-dom';
import './EditPanelLayout.css';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { createFixedBlockDescriptorCatalog } from './editPanelParts/fixedBlockDescriptorCatalog.js';

const PageThemeStylePanel = React.lazy(() => import('../panels/StylePanel.jsx'));

export function EditPanelLayout({
  pageGlobalOptionsProps,
  fixedBlocksProps,
  screenOrderListProps,
  addBlockDockProps,
  stylePanelProps,
  inspectorHost,
}) {
  const [section, setSection] = React.useState('order');
  const selectedBlockId = fixedBlocksProps?.openId || screenOrderListProps?.selectedId;

  React.useEffect(() => {
    if (selectedBlockId) setSection('order');
  }, [selectedBlockId]);

  const selectedNormal = screenOrderListProps?.normalBlocks?.find(
    (block) => block.id === screenOrderListProps.selectedId
  );
  const selectedFixed = createFixedBlockDescriptorCatalog(fixedBlocksProps || {})
    .find((descriptor) => descriptor.block.id === fixedBlocksProps?.openId);

  const inspector = (
    <section className="edit-layout editor-inspector-layout" data-inspector-section={section}>
      {section === 'options' ? (
        <>
          <h2 className="editor-inspector-heading">페이지 옵션 · 전체 디자인</h2>
          <div className="editor-page-options-stack">
            <PageGlobalOptions {...pageGlobalOptionsProps} />
            {stylePanelProps && (
              <React.Suspense fallback={<div className="editor-inspector-loading">불러오는 중</div>}>
                <PageThemeStylePanel {...stylePanelProps} />
              </React.Suspense>
            )}
          </div>
        </>
      ) : selectedNormal ? (
        <>
          <h2 className="editor-inspector-heading">블록 설정</h2>
          <div key={selectedNormal.id} className="screen-order-v2-inline-editor editor-inspector-body"
            data-scroll-region="inspector" role="region"
            aria-label="선택한 블록 상세 설정">
            {screenOrderListProps.renderBlockEditor(selectedNormal)}
          </div>
        </>
      ) : selectedFixed ? (
        <>
          <h2 className="editor-inspector-heading">{selectedFixed.title}</h2>
          <div key={selectedFixed.block.id} className="screen-order-fixed-blocks editor-inspector-body">
            <div className="fixed-block-editor selected-block-settings-body block-editor">
              {selectedFixed.renderEditor(selectedFixed.block)}
            </div>
          </div>
        </>
      ) : (
        <p className="editor-inspector-empty">왼쪽 목록이나 가운데 페이지에서 블록을 선택하세요.</p>
      )}
    </section>
  );

  return (
    <>
      <div className="edit-layout">
        <nav className="edit-section-tabs" data-pagero-ui="edit-section-tabs-v2"
          aria-label="편집 영역 선택">
          <button className="edit-section-tab" type="button"
            data-selected={section === 'order' ? 'true' : 'false'}
            aria-pressed={section === 'order'} onClick={() => setSection('order')}>
            블록 설정
          </button>
          <button className="edit-section-tab" type="button"
            data-selected={section === 'options' ? 'true' : 'false'}
            aria-pressed={section === 'options'} onClick={() => setSection('options')}>
            페이지 옵션{stylePanelProps?.hasPendingStyle ? ' · 미적용' : ''}
          </button>
        </nav>
        <div className="edit-section-panel" data-editor-section={section}>
          <ScreenOrderList {...screenOrderListProps} />
          <section className="screen-order-fixed-blocks" aria-label="고정 영역">
            <div className="section-title screen-order-fixed-blocks-title">
              <h2>고정 영역</h2>
            </div>
            <GlobalFixedBlocks {...fixedBlocksProps} inlineEditor={false} />
          </section>
        </div>
        <AddBlockDock {...addBlockDockProps} />
      </div>
      {inspectorHost && createPortal(inspector, inspectorHost)}
    </>
  );
}
