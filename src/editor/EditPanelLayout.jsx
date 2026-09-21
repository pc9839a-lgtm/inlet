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
  const [leftMode, setLeftMode] = React.useState('structure');
  const [inspectorMode, setInspectorMode] = React.useState(selectedBlockSettingsProps ? 'selection' : 'page');

  React.useEffect(() => {
    if (selectedBlockSettingsProps) setInspectorMode('selection');
    else setInspectorMode('page');
  }, [selectedBlockSettingsProps?.block?.id]);

  const showAddMode = () => {
    setLeftMode('add');
    addBlockDockProps?.setAddOpen?.(true);
  };

  const showStructureMode = () => {
    setLeftMode('structure');
    addBlockDockProps?.setAddOpen?.(false);
  };

  return (
    <div className="edit-layout editor-shell-v2">
      <section className="editor-structure-pane" aria-label="페이지 구조와 섹션 추가">
        <div className="editor-pane-heading">
          <strong>페이지 구성</strong>
        </div>

        <nav className="editor-left-modes" aria-label="페이지 구성 모드">
          <button
            type="button"
            className={leftMode === 'structure' ? 'active' : ''}
            aria-pressed={leftMode === 'structure'}
            onClick={showStructureMode}
          >
            구조
          </button>
          <button
            type="button"
            className={leftMode === 'add' ? 'active' : ''}
            aria-pressed={leftMode === 'add'}
            onClick={showAddMode}
          >
            추가
          </button>
        </nav>

        {leftMode === 'structure' ? (
          <div className="editor-structure-scroll">
            <ScreenOrderList {...screenOrderListProps} />
            <section className="screen-order-fixed-blocks" aria-label="고정 영역">
              <div className="section-title screen-order-fixed-blocks-title">
                <h2>고정 영역</h2>
              </div>
              <GlobalFixedBlocks {...fixedBlocksProps} />
            </section>
          </div>
        ) : (
          <div className="editor-add-mode">
            <AddBlockDock {...addBlockDockProps} embedded />
          </div>
        )}
      </section>

      <aside className="editor-inspector-pane" aria-label="선택 요소 설정">
        <div className="editor-pane-heading inspector-heading">
          <strong>{selectedBlockSettingsProps ? '설정' : '페이지 설정'}</strong>
        </div>

        <nav className="editor-inspector-modes" aria-label="설정 대상">
          <button
            type="button"
            className={inspectorMode === 'selection' ? 'active' : ''}
            aria-pressed={inspectorMode === 'selection'}
            disabled={!selectedBlockSettingsProps}
            onClick={() => selectedBlockSettingsProps && setInspectorMode('selection')}
          >
            선택 요소
          </button>
          <button
            type="button"
            className={inspectorMode === 'page' ? 'active' : ''}
            aria-pressed={inspectorMode === 'page'}
            onClick={() => setInspectorMode('page')}
          >
            페이지 · 테마
          </button>
        </nav>

        <div className="editor-inspector-scroll">
          {inspectorMode === 'selection' && selectedBlockSettingsProps ? (
            <SelectedBlockSettings {...selectedBlockSettingsProps} />
          ) : (
            <div className="editor-page-inspector">
              <PageGlobalOptions {...pageGlobalOptionsProps} />
              {stylePanelProps && (
                <React.Suspense fallback={<div className="editor-inspector-loading">테마 설정 불러오는 중</div>}>
                  <PageThemeStylePanel {...stylePanelProps} />
                </React.Suspense>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
