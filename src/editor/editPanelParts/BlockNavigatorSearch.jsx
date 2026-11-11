import React from 'react';
import { ChevronDown, ChevronUp, LocateFixed, Search } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { findBlockNavigationMatches } from './blockNavigatorSearchModel.js';

// Search selects existing blocks without filtering/reordering the source list.
export function BlockNavigatorSearch({ blocks = [], fixedDescriptors = [], selectedId = '', onSelect, onRevealSelected }) {
  const [query, setQuery] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const matches = React.useMemo(() => findBlockNavigationMatches({
    blocks,
    fixedDescriptors,
    query,
    getBlockLabel: (block) => META[block.s?.widgetMode === 'youtube' ? 'youtube' : block.type]?.label || block.type,
  }), [blocks, fixedDescriptors, query]);

  // Locate a row inside the existing independent block-list scroller, without
  // resetting the selected Inspector or changing saved page order.
  const revealRow = (id, focus = false) => {
    // Fixed rows may be hidden while their group expands after selection.
    // Retry a few animation frames without changing the selected page data.
    const locate = (remaining) => requestAnimationFrame(() => {
      const scroller = document.querySelector('.canvas-editor-shell .editor-composition-content');
      const target = document.getElementById(`editor-block-${id}`);
      if (!scroller || !target || !scroller.contains(target)) return;
      if (!target.getClientRects().length) {
        if (remaining > 0) locate(remaining - 1);
        return;
      }
      const view = scroller.getBoundingClientRect();
      const row = target.getBoundingClientRect();
      // Heading and search live outside the scrolling list itself.
      const top = scroller.scrollTop + row.top - view.top - 12;
      scroller.scrollTo({ top: Math.max(0, top), behavior: focus ? 'instant' : 'smooth' });
      if (focus) target.querySelector('.screen-order-v2-title-wrap')?.focus({ preventScroll: true });
    });
    locate(4);
  };

  const navigate = (index) => {
    if (!matches.length) return;
    const next = ((index % matches.length) + matches.length) % matches.length;
    const id = matches[next].id;
    setCurrentIndex(next);
    onSelect(id);
    revealRow(id);
  };
  const canLocateSelected = !query.trim() && (
    blocks.some((block) => block.id === selectedId) ||
    fixedDescriptors.some((item) => item.block?.id === selectedId)
  );

  const changeQuery = (event) => {
    setQuery(event.target.value);
    setCurrentIndex(0);
  };

  return (
    <div className="editor-composition-search" role="search" aria-label="블록 검색">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        placeholder="제목·내용·블록 검색"
        aria-label="블록 이름 검색"
        value={query}
        onChange={changeQuery}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); navigate(currentIndex); }
          if (event.key === 'Escape') { event.preventDefault(); setQuery(''); setCurrentIndex(0); }
        }}
      />
      {query.trim() && (
        <>
          <output className="editor-search-count" aria-live="polite">
            {matches.length ? `${Math.min(currentIndex, matches.length - 1) + 1}/${matches.length}` : '없음'}
          </output>
          <button type="button" aria-label="이전 검색 결과" title="이전 검색 결과" disabled={!matches.length} onClick={() => navigate(currentIndex - 1)}>
            <ChevronUp size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="다음 검색 결과" title="다음 검색 결과" disabled={!matches.length} onClick={() => navigate(currentIndex + 1)}>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </>
      )}
      {canLocateSelected && (
        <button
          className="editor-search-locate"
          type="button"
          aria-label="선택 블록 위치 찾기"
          title="선택한 블록의 목록 위치로 이동"
          onClick={() => { onRevealSelected?.(selectedId); revealRow(selectedId, true); }}
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
