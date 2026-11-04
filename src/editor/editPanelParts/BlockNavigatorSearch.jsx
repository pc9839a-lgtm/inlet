import React from 'react';
import { ChevronDown, ChevronUp, LocateFixed, Search } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';

// Search selects existing blocks without filtering/reordering the source list.
export function BlockNavigatorSearch({ blocks = [], selectedId = '', onSelect }) {
  const [query, setQuery] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const matches = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    const identities = createScreenOrderIdentities(blocks);
    return blocks.filter((block, index) => {
      const identity = identities[index];
      const label = META[block.s?.widgetMode === 'youtube' ? 'youtube' : block.type]?.label || block.type;
      return [label, identity?.customLabel, identity?.detail, identity?.occurrence]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLocaleLowerCase().includes(needle));
    });
  }, [blocks, query]);

  // Locate a search result or the selected block without adding another
  // scrollbar or changing the user's stored block list.
  const revealRow = (id, focus = false) => {
    requestAnimationFrame(() => {
      const scroller = document.querySelector('.canvas-editor-shell .work-panel');
      const target = document.getElementById(`editor-block-${id}`);
      if (!scroller || !target || !scroller.contains(target)) return;
      const view = scroller.getBoundingClientRect();
      const row = target.getBoundingClientRect();
      // Leave room for the 76px sticky heading and 42px search bar.
      const top = scroller.scrollTop + row.top - view.top - 136;
      scroller.scrollTo({ top: Math.max(0, top), behavior: focus ? 'instant' : 'smooth' });
      if (focus) target.querySelector('.screen-order-v2-title-wrap')?.focus({ preventScroll: true });
    });
  };

  const navigate = (index) => {
    if (!matches.length) return;
    const next = ((index % matches.length) + matches.length) % matches.length;
    const id = matches[next].id;
    setCurrentIndex(next);
    onSelect(id);
    revealRow(id);
  };
  const canLocateSelected = !query.trim() && blocks.some((block) => block.id === selectedId);

  const changeQuery = (event) => {
    setQuery(event.target.value);
    setCurrentIndex(0);
  };

  return (
    <div className="editor-composition-search" role="search" aria-label="블록 검색">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        placeholder="블록 이름 검색"
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
          onClick={() => revealRow(selectedId, true)}
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
