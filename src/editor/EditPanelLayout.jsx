import React from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { BlockNavigatorSearch } from './editPanelParts/BlockNavigatorSearch.jsx';
import './EditPanelLayout.css';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { createFixedBlockDescriptors } from './editPanelParts/fixedBlockDescriptors.js';
import { ScreenOrderSettings } from './editPanelParts/ScreenOrderSettings.jsx';
import { createInspectorBlockNavigation } from './editPanelParts/inspectorBlockNavigationModel.js';

const PageThemeStylePanel = React.lazy(() => import('../panels/StylePanel.jsx'));

// Collapse only the navigator rows. Fixed blocks, their editor state and page
// placement stay intact. A fresh fixed-block selection reveals its group.
function FixedCompositionGroup({ groupId, title, keys, descriptors, selectedId, revealRequest, children }) {
  const [expanded, setExpanded] = React.useState(true);
  const entries = descriptors.filter((item) => keys.includes(item.key));
  React.useEffect(() => {
    if (entries.some((item) => item.block.id === selectedId)) setExpanded(true);
  }, [selectedId]);
  React.useEffect(() => {
    if (revealRequest && entries.some((item) => item.block.id === revealRequest.id)) setExpanded(true);
  }, [revealRequest]);
  if (!entries.length) return null;

  const regionId = `editor-fixed-group-${groupId}`;
  return (
    <section className="screen-order-fixed-blocks" data-fixed-group={groupId} aria-label={`${title} 영역`}>
      <h3>
        <button
          type="button"
          className="editor-fixed-group-toggle"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="editor-fixed-group-label">{title}</span>
          <span className="editor-fixed-group-count">{entries.length}개</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </h3>
      <div id={regionId} className="editor-fixed-group-content" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

export function EditPanelLayout({
  pageGlobalOptionsProps,
  fixedBlocksProps,
  screenOrderListProps,
  addBlockDockProps,
  stylePanelProps,
}) {
  const [section, setSection] = React.useState('order');
  const [fixedSearchReveal, setFixedSearchReveal] = React.useState(null);
  const selectedBlockId = fixedBlocksProps?.openId || screenOrderListProps?.selectedId;
  // A blank selection is page-level context, not a reason to collapse the editor.
  // Show the existing page design and options until a block is selected.
  const showPageOptions = section === 'options' || !selectedBlockId;
  const fixedDescriptors = createFixedBlockDescriptors(fixedBlocksProps);
  const fixedSelected = fixedDescriptors.find((item) => item.open);
  const chooseBlock = (id) => {
    if (screenOrderListProps.selectedId !== id) screenOrderListProps.selectBlock(id);
    setSection('order');
  };
  const chooseFixed = (id) => {
    if (fixedBlocksProps.openId !== id) fixedBlocksProps.toggleBlockOpen(id);
    setSection('order');
  };
  const revealFixedSearch = (id) => {
    if (fixedDescriptors.some((item) => item.block.id === id)) setFixedSearchReveal({ id });
  };
  const chooseSearchResult = (id) => {
    if (fixedDescriptors.some((item) => item.block.id === id)) {
      revealFixedSearch(id);
      chooseFixed(id);
    } else chooseBlock(id);
  };

  // Previous/next follows the actual mobile page order, including pinned sections.
  // Keep the navigator's existing scroll position whenever the next selected row
  // is already visible; do not jump to the top of a 30+ block composition.
  const blockNavigation = createInspectorBlockNavigation({
    normalBlocks: screenOrderListProps.normalBlocks,
    fixedDescriptors,
    selectedBlockId,
  });
  const revealInspectorSelection = (id, attempts = 5) => {
    requestAnimationFrame(() => {
      const scroller = document.querySelector('.canvas-editor-shell .editor-composition-content');
      const row = document.getElementById(`editor-block-${id}`);
      if (!scroller || !row || !scroller.contains(row)) return;
      if (!row.getClientRects().length) {
        // A newly selected fixed block can still be inside a collapsed group
        // until its disclosure reacts to the change.
        if (attempts > 0) revealInspectorSelection(id, attempts - 1);
        return;
      }
      const viewport = scroller.getBoundingClientRect();
      // Header and search live outside the scrolling block list.
      const safeTop = viewport.top + 12;
      const safeBottom = viewport.bottom - 12;
      const bounds = row.getBoundingClientRect();
      if (bounds.top >= safeTop && bounds.bottom <= safeBottom) return;
      const scrollTop = scroller.scrollTop + bounds.top - safeTop;
      scroller.scrollTo({ top: Math.max(0, scrollTop), behavior: 'instant' });
    });
  };
  const switchBlock = (id) => {
    if (!id || id === selectedBlockId) return;
    if (fixedDescriptors.some((item) => item.block.id === id)) {
      revealFixedSearch(id);
      chooseFixed(id);
    } else chooseBlock(id);
    revealInspectorSelection(id);
  };
  const inspectorNavigation = blockNavigation
    ? { ...blockNavigation, onNavigate: switchBlock }
    : null;

  React.useEffect(() => {
    if (selectedBlockId) setSection('order');
  }, [selectedBlockId]);

  // Replacing the selected widget should start at the beginning of its own
  // settings, without resetting the user's position in the block navigator.
  React.useEffect(() => {
    const inspector = document.querySelector('.canvas-editor-shell .editor-inspector-panel');
    if (inspector) inspector.scrollTop = 0;
  }, [selectedBlockId, showPageOptions]);

  const openPageOptions = () => {
    if (screenOrderListProps?.selectedId) screenOrderListProps.clearBlockSelection();
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
          <div className="editor-composition-title-row">
            <div className="editor-composition-title-copy">
              <span className="editor-panel-kicker">페이지 편집</span>
              <h2>블록 구성</h2>
            </div>
            <span className="editor-composition-total">{screenOrderListProps.normalBlocks.length + fixedDescriptors.length}개</span>
          </div>
          <AddBlockDock {...addBlockDockProps} compact />
        </div>
        <BlockNavigatorSearch blocks={screenOrderListProps.normalBlocks} fixedDescriptors={fixedDescriptors} selectedId={selectedBlockId} onSelect={chooseSearchResult} onRevealSelected={revealFixedSearch} />
        <div className="editor-composition-content" role="region" aria-label="블록 목록" tabIndex={0}>
          <FixedCompositionGroup
            groupId="top" title="상단 고정" keys={['topnav']}
            descriptors={fixedDescriptors} selectedId={fixedBlocksProps.openId} revealRequest={fixedSearchReveal}
          >
            <GlobalFixedBlocks {...fixedBlocksProps} only={['topnav']} compositionRow selectedId={fixedBlocksProps.openId} openId="" toggleBlockOpen={chooseFixed} />
          </FixedCompositionGroup>
          <div className="editor-composition-group-caption">
            <span>콘텐츠 블록</span>
            <span>{screenOrderListProps.normalBlocks.length}개</span>
          </div>
          <ScreenOrderList {...screenOrderListProps} listOnly selectBlock={chooseBlock} />
          <FixedCompositionGroup
            groupId="bottom" title="하단 고정" keys={['bottom', 'footer']}
            descriptors={fixedDescriptors} selectedId={fixedBlocksProps.openId} revealRequest={fixedSearchReveal}
          >
            <GlobalFixedBlocks {...fixedBlocksProps} only={['bottom', 'footer']} compositionRow selectedId={fixedBlocksProps.openId} openId="" toggleBlockOpen={chooseFixed} />
          </FixedCompositionGroup>
        </div>
        <div className="editor-composition-footer">
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
      </aside>
      <section className="editor-inspector-panel" role="region" aria-label="선택 항목 편집" tabIndex={0}>
      <div id="editor-selection-panel" className="edit-section-panel" data-editor-section={showPageOptions ? 'options' : section}>
        {showPageOptions ? (
          <div className="editor-page-options-stack">
            <header className="editor-page-options-heading">
              <span className="editor-panel-kicker">페이지 전체</span>
              <h2>디자인과 설정</h2>
            </header>
            {stylePanelProps && (
              <React.Suspense fallback={<div className="editor-inspector-loading">불러오는 중</div>}>
                <PageThemeStylePanel {...stylePanelProps} />
              </React.Suspense>
            )}
            <PageGlobalOptions {...pageGlobalOptionsProps} page={{ ...pageGlobalOptionsProps.page, theme: pageTheme }} updateTheme={updatePageTheme} />
          </div>
        ) : (
          <>
            {fixedSelected ? <ScreenOrderSettings block={fixedSelected.block} identity={{ customLabel: fixedSelected.title }} renderBlockEditor={fixedSelected.renderEditor} navigation={inspectorNavigation} />
              : <ScreenOrderList {...screenOrderListProps} inspectorOnly inspectorNavigation={inspectorNavigation} />}
          </>
        )}
      </div>

      </section>
    </div>
  );
}
