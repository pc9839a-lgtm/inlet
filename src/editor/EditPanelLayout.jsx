import React from 'react';
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
  selectedBlockSettingsProps,
  stylePanelProps,
}) {
  const [section, setSection] = React.useState('order');

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
          페이지 옵션
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

      <div className="edit-section-panel">
        {section === 'options' ? (
          <div className="editor-page-options-stack">
            <PageGlobalOptions {...pageGlobalOptionsProps} />
            {stylePanelProps && (
              <React.Suspense fallback={<div className="editor-inspector-loading">테마 설정 불러오는 중</div>}>
                <PageThemeStylePanel {...stylePanelProps} />
              </React.Suspense>
            )}
          </div>
        ) : (
          <>
            <ScreenOrderList
              {...screenOrderListProps}
              selectedBlockSettingsProps={selectedBlockSettingsProps}
            />
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
