import React, { useState } from 'react';
import { AddBlockGroupGrid } from './AddBlockGroupGrid.jsx';
import { AddBlockOption } from './AddBlockOption.jsx';
import { getAddableBlocksByCategory } from './addBlockCatalog.js';
import { ADD_GROUPS } from './editorLabels.js';

const RECENT_BLOCKS_KEY = 'pagero.editor.recent-blocks.v1';
const MAX_RECENT_BLOCKS = 5;
const ADDABLE_BLOCKS = new Map(
  ADD_GROUPS.flatMap(([category]) => getAddableBlocksByCategory(category)),
);

function loadRecentBlockTypes() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_BLOCKS_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((type) => ADDABLE_BLOCKS.has(type)).slice(0, MAX_RECENT_BLOCKS);
  } catch {
    return [];
  }
}

function saveRecentBlockTypes(types) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_BLOCKS_KEY, JSON.stringify(types));
  } catch {}
}

export function AddBlockPanel({ onAdd }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [recentTypes, setRecentTypes] = useState(loadRecentBlockTypes);
  const recentItems = recentTypes
    .map((type) => [type, ADDABLE_BLOCKS.get(type)])
    .filter(([, meta]) => Boolean(meta));

  const handleAdd = (addType, preset = '', catalogType = addType) => {
    onAdd(addType, preset);
    const recentType = ADDABLE_BLOCKS.has(catalogType)
      ? catalogType
      : (ADDABLE_BLOCKS.has(addType) ? addType : '');
    if (!recentType) return;
    const next = [recentType, ...recentTypes.filter((type) => type !== recentType)].slice(0, MAX_RECENT_BLOCKS);
    saveRecentBlockTypes(next);
    setRecentTypes(next);
  };

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    if (nextQuery.trim()) setCategory('all');
  };

  return (
    <div className="add-panel">
      <div className="widget-search">
        <label htmlFor="pagero-widget-search">위젯 찾기</label>
        <input
          id="pagero-widget-search"
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="텍스트, 이미지, 동영상…"
          autoComplete="off"
        />
      </div>

      <div className="widget-category-filter" role="group" aria-label="위젯 카테고리">
        <button
          type="button"
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          전체
        </button>
        {ADD_GROUPS.map(([categoryKey, label]) => (
          <button
            key={categoryKey}
            type="button"
            aria-pressed={category === categoryKey}
            onClick={() => setCategory(categoryKey)}
          >
            {label}
          </button>
        ))}
      </div>

      {!query.trim() && category === 'all' && recentItems.length > 0 && (
        <div className="widget-group widget-recent-group">
          <b>최근 사용</b>
          <div>
            {recentItems.map(([type, meta]) => (
              <AddBlockOption key={type} type={type} meta={meta} onAdd={handleAdd} />
            ))}
          </div>
        </div>
      )}

      <AddBlockGroupGrid onAdd={handleAdd} query={query} category={category} />
    </div>
  );
}
