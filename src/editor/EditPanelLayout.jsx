import React from 'react';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { SelectedBlockSettings } from './editPanelParts/SelectedBlockSettings.jsx';

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
      <nav className="edit-section-tabs" aria-label="편집 영역 선택">
        <button
          className={section === 'options' ? 'active' : ''}
          type="button"
          aria-pressed={section === 'options'}
          onClick={() => setSection('options')}
        >
          페이지 옵션
        </button>
        <button
          className={section === 'order' ? 'active' : ''}
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
            <ScreenOrderList {...screenOrderListProps} />
            {selectedBlockSettingsProps && (
              <div className="screen-order-v2-settings-panel">
                <SelectedBlockSettings {...selectedBlockSettingsProps} />
              </div>
            )}
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
