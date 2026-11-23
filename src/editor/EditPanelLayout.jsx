import React from 'react';
import { ChevronDown, Settings2, Layers3, ArrowLeft } from 'lucide-react';
import { BlockNavigatorSearch } from './editPanelParts/BlockNavigatorSearch.jsx';
import './EditPanelLayout.css';
import './EditorWorkflow.css';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { GlobalFixedBlocks } from './editPanelParts/GlobalFixedBlocks.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { createFixedBlockDescriptors } from './editPanelParts/fixedBlockDescriptors.js';
import { ScreenOrderSettings } from './editPanelParts/ScreenOrderSettings.jsx';
import { createInspectorBlockNavigation } from './editPanelParts/inspectorBlockNavigationModel.js';
import { isExplicitlyHidden } from './editPanelParts/screenOrderIdentityModel.js';

const PageThemeStylePanel = React.lazy(() => import('../panels/StylePanel.jsx'));

// Collapse only the navigator rows. Fixed blocks, their editor state and page
// placement stay intact. A fresh fixed-block selection reveals its group.
function FixedCompositionGroup({ groupId, title, keys, descriptors, selectedId, revealRequest, children }) {
  const [expanded, setExpanded] = React.useState(false);
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
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </h3>
      <div id={regionId} className="editor-fixed-group-content" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}


function StartEditing() {
  return (
    <section className="editor-workflow-start" role="region" aria-label="편집 시작">
      <h2>수정할 곳을 선택하세요</h2>
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
  const [navigatorOpen, setNavigatorOpen] = React.useState(false);
  // Beginner flow: show a single task on the left. A selected block replaces
  // the list instead of squeezing a second permanent settings column beside it.
  // The real 390px preview always stays visible on desktop.
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  // The editor's usable width can be smaller than the CSS viewport (zoom,
  // embedded windows, resized desktop panes). Never decide its layout only
  // from window.innerWidth; measure the actual available stage as well.
  const [editorDensity, setEditorDensity] = React.useState(() => (
    typeof window !== 'undefined' && Math.min(
      window.innerWidth, window.visualViewport?.width || Infinity,
    ) < 900 ? 'compact' : 'wide'
  ));
  const [compactView, setCompactView] = React.useState('page');
  // A selected inspector from desktop must not become the *only* visible
  // pane after a user narrows the app. Enter every new compact session on
  // the actual page; preserve explicit page/blocks/edit choices afterward.
  const previousDensity = React.useRef(editorDensity);
  React.useEffect(() => {
    if (editorDensity === 'compact' && previousDensity.current !== 'compact') {
      setCompactView('page');
      setNavigatorOpen(false);
    }
    previousDensity.current = editorDensity;
  }, [editorDensity]);
  React.useEffect(() => {
    const shell = document.querySelector('.builder-shell.canvas-editor-shell');
    if (!shell) return undefined;
    const measure = () => {
      const available = Math.min(
        shell.getBoundingClientRect().width || Infinity,
        document.documentElement.clientWidth || Infinity,
        window.visualViewport?.width || Infinity,
      );
      setEditorDensity(available < 900 ? 'compact' : available < 1280 ? 'laptop' : 'wide');
    };
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(measure) : null;
    observer?.observe(shell);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);
  React.useEffect(() => {
    let focusFrame = 0;
    const openSelectedContent = () => {
      setInspectorOpen(true);
      if (editorDensity !== 'compact') return;
      setCompactView('edit');
      // Canvas controls become display:none in compact mode. A click (or
      // keyboard activation) must hand focus to the newly visible Inspector,
      // not leave it in the hidden 390px page. Specialized image/form/link
      // handlers may focus an exact field first; never override that focus.
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(() => {
        const inspector = document.querySelector('.canvas-editor-shell .editor-properties-content');
        if (!inspector?.getClientRects().length || inspector.contains(document.activeElement)) return;
        const heading = inspector.querySelector('.screen-order-v2-settings-title h2');
        (heading?.getClientRects().length ? heading : inspector).focus({ preventScroll: true });
      });
    };
    window.addEventListener('pagero:editor-preview-select', openSelectedContent);
    return () => {
      window.removeEventListener('pagero:editor-preview-select', openSelectedContent);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [editorDensity]);

  // Legacy laptop drawer interaction remains for compact transitions. Dismiss it
  // when the user works in the canvas or inspector, without cancelling the
  // pointer event or altering the selected block or page draft.
  React.useEffect(() => {
    if (!navigatorOpen) return undefined;
    const dismissOnOutsidePointer = (event) => {
      if (editorDensity !== 'laptop') return;
      const panel = document.getElementById('editor-composition-panel');
      const trigger = document.querySelector('.editor-navigator-drawer-trigger');
      // Block actions and the compact add-block gallery render in body
      // portals. They belong to the navigator, so interactions there must
      // not hide the add button that the gallery restores focus to.
      if (panel?.contains(event.target) || trigger?.contains(event.target)
        || event.target?.closest?.('[data-composition-action-menu="true"]')
        || event.target?.closest?.('.editor-gallery-backdrop')) return;
      setNavigatorOpen(false);
      requestAnimationFrame(() => {
        // Non-focusable canvas chrome can leave keyboard focus in the now
        // hidden drawer. A newly focused outside control takes precedence.
        if (panel?.contains(document.activeElement)) trigger?.focus({ preventScroll: true });
      });
    };
    document.addEventListener('pointerdown', dismissOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', dismissOnOutsidePointer, true);
  }, [navigatorOpen, editorDensity]);
  const selectedBlockId = fixedBlocksProps?.openId || screenOrderListProps?.selectedId;
  // Content editing is the default; page-level options require an explicit choice.
  const showPageOptions = section === 'design' || section === 'page';
  const showStartEditing = !showPageOptions && !selectedBlockId;
  // The account page can hydrate after the shell first renders. Do not consume
  // the one-time selection attempt until the selected block actually appears.
  // Explicit page-level destinations suspend this automatic content selection.
  const firstSelectionConfirmed = React.useRef(false);
  React.useEffect(() => {
    if (firstSelectionConfirmed.current || section !== 'order') return;
    if (selectedBlockId) {
      firstSelectionConfirmed.current = true;
      return;
    }
    const first = screenOrderListProps.normalBlocks.find((block) => !isExplicitlyHidden(block));
    if (first) screenOrderListProps.selectBlock(first.id);
  }, [section, selectedBlockId, screenOrderListProps.normalBlocks, screenOrderListProps.selectBlock]);
  const fixedDescriptors = createFixedBlockDescriptors(fixedBlocksProps);
  const fixedSelected = fixedDescriptors.find((item) => item.open);
  // Keep navigation and widget settings in independent scrollers.
  // The active widget editor mounts once, outside the composition.
  // Only the actual selected code block may request more horizontal room.
  // Page-level settings and every other widget retain the standard Inspector.
  const selectedEditorType = !showPageOptions
    ? screenOrderListProps.normalBlocks.find((block) => block.id === selectedBlockId)?.type
      || fixedSelected?.block?.type || ''
    : '';
  // Focus belongs to an explicit user selection, never the automatic
  // first-content selection on workspace entry or a tab switch.
  const focusInspectorHeading = (id, attempts = 4) => {
    requestAnimationFrame(() => {
      const settings = document.getElementById(`editor-block-settings-${id}`);
      const heading = settings?.closest('.screen-order-v2-settings-view')?.querySelector('.screen-order-v2-settings-title h2');
      if (heading?.getClientRects().length) heading.focus({ preventScroll: true });
      else if (attempts > 0) focusInspectorHeading(id, attempts - 1);
    });
  };
  const chooseBlock = (id, { focusHeading = true } = {}) => {
    setInspectorOpen(true);
    if (screenOrderListProps.selectedId !== id) screenOrderListProps.selectBlock(id);
    setSection('order');
    setNavigatorOpen(false);
    if (editorDensity === 'compact') setCompactView('edit');
    if (focusHeading) focusInspectorHeading(id);
  };
  const chooseFixed = (id, { focusHeading = true } = {}) => {
    setInspectorOpen(true);
    if (fixedBlocksProps.openId !== id) fixedBlocksProps.toggleBlockOpen(id);
    setSection('order');
    setNavigatorOpen(false);
    if (editorDensity === 'compact') setCompactView('edit');
    if (focusHeading) focusInspectorHeading(id);
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
    // Inspector navigation is a repeated keyboard action, not a new list
    // selection. Keep focus in the previous/next controls so Enter can step
    // through neighboring blocks without losing the tab position each time.
    const direction = id === blockNavigation?.nextId ? 'next' : 'previous';
    if (fixedDescriptors.some((item) => item.block.id === id)) {
      revealFixedSearch(id);
      chooseFixed(id, { focusHeading: false });
    } else chooseBlock(id, { focusHeading: false });
    revealInspectorSelection(id);
    const restoreSwitchFocus = (attempts = 5) => requestAnimationFrame(() => {
      const settings = document.querySelector('.canvas-editor-shell .editor-composition-content [data-block-settings-id]')
        || document.querySelector('.canvas-editor-shell .editor-properties-content [data-block-settings-id]');
      if (settings?.getAttribute('data-block-settings-id') !== id) {
        if (attempts > 0) restoreSwitchFocus(attempts - 1);
        return;
      }
      const buttons = [...document.querySelectorAll('.canvas-editor-shell .editor-block-switch-actions button')];
      const primary = buttons.find((button) => button.getAttribute('aria-label') === (direction === 'next' ? '다음 블록' : '이전 블록'));
      const fallback = buttons.find((button) => !button.disabled);
      (primary && !primary.disabled ? primary : fallback)?.focus({ preventScroll: true });
    });
    restoreSwitchFocus();
  };
  const inspectorNavigation = blockNavigation
    ? { ...blockNavigation, onNavigate: switchBlock }
    : null;

  React.useEffect(() => {
    if (selectedBlockId) setSection('order');
    // A different selected block has a different starting context. Reusing
    // the previous block's deep scroll makes the new content appear empty.
    document.querySelector('.canvas-editor-shell .editor-properties-content')
      ?.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedBlockId, editorDensity]);

  const openPageOptions = (destination = 'design') => {
    setInspectorOpen(true);
    if (screenOrderListProps?.selectedId) screenOrderListProps.clearBlockSelection();
    else if (fixedBlocksProps?.openId) fixedBlocksProps.toggleBlockOpen(fixedBlocksProps.openId);
    setSection(destination);
    setNavigatorOpen(false);
    if (editorDensity === 'compact') setCompactView('edit');
    // A laptop navigator hides after selection. Move keyboard focus into the
    // real page inspector instead of leaving it inside the hidden drawer.
    const focusPageHeading = (attempts = 5) => requestAnimationFrame(() => {
      const inspector = document.querySelector('.canvas-editor-shell .editor-properties-content');
      const heading = inspector?.querySelector('[data-editor-section="options"] .editor-page-options-heading h2');
      if (!heading?.getClientRects().length) {
        if (attempts > 0) focusPageHeading(attempts - 1);
        return;
      }
      inspector.scrollTo({ top: 0, behavior: 'instant' });
      heading.focus({ preventScroll: true });
    });
    focusPageHeading();
  };

  const returnToBlocks = (event) => {
    // Pointer activation should not draw a keyboard focus ring on the
    // navigator heading. Keyboard activation must retain a visible target.
    const keyboardActivation = event?.detail === 0;
    setInspectorOpen(false);
    setNavigatorOpen(false);
    if (editorDensity === 'compact') setCompactView('blocks');
    requestAnimationFrame(() => {
      const selector = editorDensity === 'compact'
        ? '.editor-workflow-compact-switch button:nth-child(2)'
        : keyboardActivation
          ? '.editor-composition-heading h2'
          : '.editor-composition-panel';
      document.querySelector(selector)?.focus({ preventScroll: true });
    });
  };

  const pageTheme = stylePanelProps?.stagedTheme || pageGlobalOptionsProps.page.theme;
  const updatePageTheme = (patch) => {
    // Page behavior belongs to the undoable page draft, not the optional
    // staged visual-design changes. Resetting visual design must never undo
    // a separate animation change made from Page Settings.
    pageGlobalOptionsProps.updateTheme(patch);
    // When visual colors are still staged, rebase their preview on the page
    // behavior change so toggles are immediately reflected in the real page.
    if (stylePanelProps?.stagedTheme && stylePanelProps?.onPreviewThemeChange) {
      stylePanelProps.onPreviewThemeChange((current) => (
        current ? { ...current, ...patch } : current
      ));
    }
  };

  // D05: row selection must not auto-scroll the outer editor. An explicit
  // preview-to-editor click is handled by useWorkspaceShellActions.

  // Keep real widget editors mounted in the separate settings area. Never
  // create an alternate page model; the page list and canvas share selection.
  const renderFixedSettings = () => {
    if (showPageOptions || !fixedSelected) return null;
    return (
      <ScreenOrderSettings
        block={fixedSelected.block}
        identity={{ customLabel: fixedSelected.title }}
        renderBlockEditor={fixedSelected.renderEditor}
        navigation={inspectorNavigation}
      />
    );
  };
  return (
    <div className="edit-layout" data-editor-layout="separate-workbench" data-editor-experience="separate-settings" data-inspector-side="left" data-inspector-kind={showPageOptions ? 'page' : fixedSelected ? 'fixed' : 'block'} data-editor-workflow="page-first" data-inspector-open={inspectorOpen ? 'true' : 'false'} data-selected-block-type={selectedEditorType} data-editor-density={editorDensity} data-compact-view={compactView}>
      <div className="editor-workflow-compact-switch" role="group" aria-label="편집 작업 영역 선택">
        <button type="button" aria-pressed={compactView === 'page'} onClick={() => setCompactView('page')}>실제 페이지</button>
        <button type="button" aria-pressed={compactView === 'blocks'} onClick={() => setCompactView('blocks')}>블록 목록</button>
        <button type="button" aria-pressed={compactView === 'edit'} onClick={() => { setInspectorOpen(true); setCompactView('edit'); }}>내용 수정</button>
      </div>
      <button
        type="button"
        className="editor-navigator-drawer-trigger"
        aria-controls="editor-composition-panel"
        aria-expanded={navigatorOpen}
        onClick={() => setNavigatorOpen((open) => !open)}
        onKeyDown={(event) => {
          // Focus remains on the trigger after opening the laptop drawer.
          // Escape must work there as well as inside the block list.
          if (event.key === 'Escape' && navigatorOpen) {
            event.preventDefault();
            setNavigatorOpen(false);
          }
        }}
      >
        {navigatorOpen ? '블록 닫기' : '블록'}
      </button>
      <aside
        id="editor-composition-panel"
        className="editor-composition-panel"
        tabIndex={-1}
        data-drawer-open={navigatorOpen ? 'true' : 'false'}
        aria-label="페이지 블록 목록"
        onKeyDown={(event) => {
          // Do not dismiss the laptop navigator when an IME owns Escape.
          // The search input also stops bubbling for unflagged composition.
          if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
          if (event.key === 'Escape' && navigatorOpen) {
            setNavigatorOpen(false);
            document.querySelector('.editor-navigator-drawer-trigger')?.focus();
          }
        }}
      >
        <header className="editor-composition-heading">
          <div className="editor-composition-title-row">
            <div className="editor-composition-title-copy">
              <h2 tabIndex={-1}>블록</h2>
            </div>
          </div>
          <AddBlockDock {...addBlockDockProps} compact />
        </header>
        {screenOrderListProps.normalBlocks.length + fixedDescriptors.length >= 8 && (
          <BlockNavigatorSearch
            blocks={screenOrderListProps.normalBlocks}
            fixedDescriptors={fixedDescriptors}
            selectedId={selectedBlockId}
            onSelect={chooseSearchResult}
            onRevealSelected={revealFixedSearch}
          />
        )}
        <div className="editor-composition-content" role="region" aria-label="블록 순서" tabIndex={0}>
          <FixedCompositionGroup
            groupId="top" title="상단 고정" keys={['topnav']}
            descriptors={fixedDescriptors}
            selectedId={fixedBlocksProps.openId}
            revealRequest={fixedSearchReveal}
          >
            <GlobalFixedBlocks {...fixedBlocksProps} only={['topnav']}
              compositionRow selectedId={fixedBlocksProps.openId}
              openId="" toggleBlockOpen={chooseFixed}
               />
          </FixedCompositionGroup>
           <ScreenOrderList
            {...screenOrderListProps}
            listOnly
            selectBlock={chooseBlock}
          />
          <FixedCompositionGroup
            groupId="bottom" title="하단 고정" keys={['bottom', 'footer']}
            descriptors={fixedDescriptors}
            selectedId={fixedBlocksProps.openId}
            revealRequest={fixedSearchReveal}
          >
            <GlobalFixedBlocks {...fixedBlocksProps} only={['bottom', 'footer']}
              compositionRow selectedId={fixedBlocksProps.openId}
              openId="" toggleBlockOpen={chooseFixed}
               />
          </FixedCompositionGroup>
        </div>
        <footer className="editor-composition-footer">
          <details className="editor-page-more">
            <summary>
              <Settings2 size={18} aria-hidden="true" />
              페이지 전체 설정
              {stylePanelProps?.hasPendingStyle && <span className="editor-settings-pending" aria-label="미적용 디자인 변경" />}
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className="editor-page-more-actions">
              <button className="editor-page-settings-button" type="button"
                aria-pressed={section === 'design'}
                onClick={() => openPageOptions('design')}>
                <Layers3 size={18} aria-hidden="true" /> 전체 디자인
              </button>
              <button className="editor-page-settings-button" type="button"
                aria-pressed={section === 'page'}
                onClick={() => openPageOptions('page')}>
                <Settings2 size={18} aria-hidden="true" /> 페이지 설정
              </button>
            </div>
          </details>
        </footer>
      </aside>
      <aside className="editor-properties-panel" aria-label="선택한 항목 편집">
        <header className="editor-properties-heading">
          <div className="editor-properties-heading-copy">
            <strong>{section === 'design' ? '전체 디자인' : section === 'page' ? '페이지 설정' : '블록 수정'}</strong>
          </div>
          <button type="button" className="editor-workbench-close-inspector"
            aria-label="블록 목록으로 돌아가기"
            onClick={returnToBlocks}>
            <ArrowLeft size={18} aria-hidden="true" /> 목록
          </button>
        </header>
        <div className="editor-properties-content" role="region" aria-label="선택 항목 편집" tabIndex={0}>
          {showPageOptions && (
            <section className="editor-inspector-panel editor-inline-settings editor-page-inline-settings">
              <div id="editor-selection-panel" className="edit-section-panel" data-editor-section="options">
                <div className="editor-page-options-stack">
                  <header className="editor-page-options-heading">
                    <span className="editor-panel-kicker">페이지 전체</span>
                    <h2 tabIndex={-1}>{section === 'design' ? '전체 디자인' : '페이지 설정'}</h2>
                  </header>
                  {section === 'design' && stylePanelProps && (
                    <React.Suspense fallback={<div className="editor-inspector-loading">불러오는 중</div>}>
                      <PageThemeStylePanel {...stylePanelProps} />
                    </React.Suspense>
                  )}
                  {section === 'page' && <PageGlobalOptions
                    {...pageGlobalOptionsProps}
                    page={{ ...pageGlobalOptionsProps.page, theme: pageTheme }}
                    updateTheme={updatePageTheme}
                  />}
                </div>
              </div>
            </section>
          )}
          {showStartEditing && (
             <StartEditing />
           )}
           {!showPageOptions && inspectorOpen && fixedSelected && (
            <section className="editor-inspector-panel editor-inline-settings">
              <div id="editor-selection-panel" className="edit-section-panel" data-editor-section="order">
                {renderFixedSettings()}
              </div>
            </section>
          )}
          {!showPageOptions && inspectorOpen && !showStartEditing && !fixedSelected && (
            <section className="editor-inspector-panel editor-inline-settings">
              <div id="editor-selection-panel" className="edit-section-panel" data-editor-section="order">
                <ScreenOrderList {...screenOrderListProps} inspectorNavigation={inspectorNavigation} />
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
