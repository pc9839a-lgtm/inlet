import React, { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { AddBlockGroupGrid } from './AddBlockGroupGrid.jsx';
import { AddBlockOption } from './AddBlockOption.jsx';
import { AddSectionPatternGrid } from './AddSectionPatternGrid.jsx';
import { getAddableBlocksByCategory } from './addBlockCatalog.js';
import { ADD_GROUPS } from './editorLabels.js';
import { getSectionPattern } from './sectionPatternCatalog.js';

const RECENT_ADDITIONS_KEY = 'pagero.editor.recent-additions.v2';
const LEGACY_RECENT_BLOCKS_KEY = 'pagero.editor.recent-blocks.v1';
const MAX_RECENT_ITEMS = 7;
const ADDABLE_BLOCKS = new Map(
  ADD_GROUPS.flatMap(([category]) => getAddableBlocksByCategory(category)),
);
const MODES = [
  ['recommended', '추천 섹션'],
  ['industry', '업종별'],
  ['basic', '기본 블록'],
  ['recent', '최근 사용'],
];

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, '');
}

function loadRecentKeys() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_ADDITIONS_KEY) || '[]');
    if (Array.isArray(stored) && stored.length) {
      return stored.filter((value) => typeof value === 'string').slice(0, MAX_RECENT_ITEMS);
    }
  } catch {}
  try {
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_RECENT_BLOCKS_KEY) || '[]');
    if (!Array.isArray(legacy)) return [];
    return legacy
      .filter((type) => ADDABLE_BLOCKS.has(type))
      .map((type) => `block:${type}`)
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

function saveRecentKeys(keys) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_ADDITIONS_KEY, JSON.stringify(keys));
  } catch {}
}

function matchesRecent(key, query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  if (key.startsWith('pattern:')) {
    const pattern = getSectionPattern(key.slice('pattern:'.length));
    return normalizeSearch([pattern?.label, pattern?.description, pattern?.industry, ...(pattern?.tags || [])].filter(Boolean).join(' ')).includes(normalized);
  }
  const type = key.slice('block:'.length);
  const meta = ADDABLE_BLOCKS.get(type);
  return normalizeSearch([type, meta?.label, meta?.badge].filter(Boolean).join(' ')).includes(normalized);
}

export function AddBlockPanel({ onAdd, onAddPattern }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('recommended');
  const [category, setCategory] = useState('all');
  const [recentKeys, setRecentKeys] = useState(loadRecentKeys);

  const remember = (key) => {
    const next = [key, ...recentKeys.filter((value) => value !== key)].slice(0, MAX_RECENT_ITEMS);
    saveRecentKeys(next);
    setRecentKeys(next);
  };

  const handleAdd = (addType, preset = '', catalogType = addType) => {
    onAdd(addType, preset);
    const recentType = ADDABLE_BLOCKS.has(catalogType)
      ? catalogType
      : (ADDABLE_BLOCKS.has(addType) ? addType : '');
    if (recentType) remember(`block:${recentType}`);
  };

  const handleAddPattern = (patternId) => {
    if (!onAddPattern) return;
    onAddPattern(patternId);
    remember(`pattern:${patternId}`);
  };

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    if (mode === 'basic' && nextQuery.trim()) setCategory('all');
  };

  const recent = recentKeys.filter((key) => matchesRecent(key, query));

  return (
    <div className="add-panel section-add-panel">
      <nav className="section-add-modes" aria-label="추가 항목 종류">
        {MODES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={mode === key ? 'active' : ''}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="widget-search">
        <label htmlFor="pagero-widget-search">섹션 또는 블록 찾기</label>
        <input
          id="pagero-widget-search"
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="상담, FAQ, 지도, 이미지…"
          autoComplete="off"
        />
      </div>

      {mode === 'recommended' && (
        <AddSectionPatternGrid mode="recommended" query={query} onAddPattern={handleAddPattern} />
      )}

      {mode === 'industry' && (
        <AddSectionPatternGrid mode="industry" query={query} onAddPattern={handleAddPattern} />
      )}

      {mode === 'basic' && (
        <>
          <div className="widget-category-filter" role="group" aria-label="블록 카테고리">
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
          <AddBlockGroupGrid onAdd={handleAdd} query={query} category={category} />
        </>
      )}

      {mode === 'recent' && (
        <div className="recent-additions">
          {!recent.length ? <div className="widget-add-empty" role="status">최근 추가한 섹션이나 블록이 없습니다.</div> : null}
          {recent.map((key) => {
            if (key.startsWith('pattern:')) {
              const pattern = getSectionPattern(key.slice('pattern:'.length));
              if (!pattern) return null;
              return (
                <button key={key} type="button" className="section-pattern-card recent-pattern-card" onClick={() => handleAddPattern(pattern.id)}>
                  <span className="section-pattern-icon" aria-hidden="true"><Layers3 size={17} /></span>
                  <span className="section-pattern-copy">
                    <strong>{pattern.label}</strong>
                    <small>{pattern.description}</small>
                  </span>
                </button>
              );
            }
            const type = key.slice('block:'.length);
            const meta = ADDABLE_BLOCKS.get(type) || META[type];
            if (!meta) return null;
            return (
              <div key={key} className="recent-block-item">
                <AddBlockOption type={type} meta={meta} onAdd={handleAdd} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
