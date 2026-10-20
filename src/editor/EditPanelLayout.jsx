import React from 'react';
import './EditPanelLayout.css';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';

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

  React.useEffect(() => {
    if (selectedBlockId) setSection('order');
  }, [selectedBlockId]);

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
          data-selected={section === 'options' ? 'true' : 'false'}
          type="button"
          aria-pressed={section === 'options'}
          onClick={() => setSection('options')}
        >
          페이지 옵션{stylePanelProps?.hasPendingStyle ? ' · 미적용' : ''}
        </button>
        <button
          className="edit-section-tab"
          data-selected={section === 'order' ? 'true' : 'false'}
          type="button"
          aria-pressed={section === 'order'}
          onClick={() => setSection('order')}
        >
          화면 순서
        </button>
      </nav>

      <p className="edit-workflow-hint">
        일반 입력은 미리보기에서 바로 확인됩니다. 공통 스타일·코드는 '적용' 후 편집본에 포함되며, 공개는 '발행' 후입니다.
      </p>
      <div className="edit-section-panel" data-editor-section={section}>
        {section === 'options' ? (
          <div className="editor-page-options-stack">
            <PageGlobalOptions {...pageGlobalOptionsProps} />
            {stylePanelProps && (
              <React.Suspense fallback={<div className="editor-inspector-loading">불러오는 중</div>}>
                <PageThemeStylePanel {...stylePanelProps} />
              </React.Suspense>
            )}
          </div>
        ) : (
          <>
            <ScreenOrderList {...screenOrderListProps} />
            <section className="screen-order-fixed-blocks" aria-label="고정 영역">
              <div className="section-title screen-order-fixed-blocks-title">
                <h2>고정 영역</h2>
              </div>
              <GlobalFixedBlocks {...fixedBlocksProps} />
            </section>
          </>
        )}
      </div>

      {section === 'order' && <AddBlockDock {...addBlockDockProps} />}
    </div>
  );
}
