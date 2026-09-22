import React from 'react';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { SelectedBlockSettings } from './editPanelParts/SelectedBlockSettings.jsx';
import { PageThemeInspector } from './editPanelParts/PageThemeInspector.jsx';

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
          <div>
            <strong>페이지 구성</strong>
          </div>
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
            <div className="editor-add-intro">
              <strong>섹션 추가</strong>
            </div>
            <AddBlockDock {...addBlockDockProps} embedded />
          </div>
        )}
      </section>

      <aside className="editor-inspector-pane" aria-label="선택 요소 설정">
        <div className="editor-pane-heading inspector-heading">
          <div>
            <strong>설정</strong>
          </div>
        </div>

        {selectedBlockSettingsProps && (
          <nav className="editor-inspector-modes" aria-label="설정 대상">
            <button
              type="button"
              className={inspectorMode === 'selection' ? 'active' : ''}
              aria-pressed={inspectorMode === 'selection'}
              onClick={() => setInspectorMode('selection')}
            >
              선택
            </button>
            <button
              type="button"
              className={inspectorMode === 'page' ? 'active' : ''}
              aria-pressed={inspectorMode === 'page'}
              onClick={() => setInspectorMode('page')}
            >
              페이지
            </button>
          </nav>
        )}

        <div className="editor-inspector-scroll">
          {inspectorMode === 'selection' && selectedBlockSettingsProps ? (
            <SelectedBlockSettings {...selectedBlockSettingsProps} />
          ) : (
            <div className="editor-page-inspector">
              <section className="editor-inspector-section">
                <div className="editor-inspector-section-title">페이지</div>
                <PageGlobalOptions {...pageGlobalOptionsProps} showTitle={false} />
              </section>
              {stylePanelProps && (
                <section className="editor-inspector-section">
                  <div className="editor-inspector-section-title">테마</div>
                  <PageThemeInspector page={stylePanelProps.page} updateTheme={stylePanelProps.updateTheme} />
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
