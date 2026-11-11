import React from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { ADD_GROUPS } from './editorLabels.js';
import { AddBlockGroupGrid } from './AddBlockGroupGrid.jsx';

// Start with an immediately scannable set of choices. The full catalogue is
// available on demand, without showing two competing lists at once.
const QUICK_BLOCKS = [
  ['hero', '첫 화면', '대표 이미지와 제목'],
  ['text', '글', '제목과 본문'],
  ['image', '이미지', '사진과 갤러리'],
  ['links', '버튼 · 링크', '연결 버튼'],
  ['form', '문의 폼', '신청·상담 접수'],
  ['reservation', '방문 예약', '날짜와 시간'],
  ['youtube', '동영상', '영상 삽입'],
  ['spacer', '여백', '블록 사이 간격'],
];

export function AddBlockPanel({ onAdd }) {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [showAll, setShowAll] = React.useState(false);
  const normalized = query.trim().toLocaleLowerCase();
  const showingCatalog = showAll || Boolean(normalized);

  return (
    <div className="add-panel editor-block-gallery">
      <label className="editor-gallery-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim()) setCategory('all'); }}
          aria-label="추가할 블록 검색"
          placeholder="필요한 블록 검색"
        />
      </label>

      <div className="editor-block-gallery-featured" hidden={showingCatalog}>
        <div className="editor-gallery-section-title">
          <h3>자주 쓰는 블록</h3>
        </div>
        <div className="editor-gallery-quick-grid">
          {QUICK_BLOCKS.filter(([type]) => META[type]).map(([type, label, description]) => {
            const Icon = META[type].icon;
            return (
              <button key={type} type="button" className="editor-gallery-quick"
                onClick={() => onAdd(type)} aria-label={`${label} 블록 추가`}>
                <span className="editor-gallery-quick-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="editor-gallery-quick-text">
                  <strong className="editor-gallery-quick-title">{label}</strong>
                  <small>{description}</small>
                </span>
                <ChevronRight size={15} className="editor-gallery-quick-chevron" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <button type="button" className="editor-gallery-show-all" onClick={() => setShowAll(true)}>
          모든 블록 보기 <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="editor-block-gallery-all" hidden={!showingCatalog}>
        <div className="editor-gallery-section-title">
          <button type="button" className="editor-gallery-back" onClick={() => { setShowAll(false); setQuery(''); setCategory('all'); }}>
            <ArrowLeft size={16} aria-hidden="true" /> 자주 쓰는 블록
          </button>
          <span>모든 블록</span>
        </div>
        <div className="editor-gallery-categories" role="group" aria-label="블록 종류">
          {[['all', '전체'], ...ADD_GROUPS].map(([key, label]) => (
            <button key={key} type="button" className={category === key ? 'is-active' : ''}
              aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>
          ))}
        </div>
        <AddBlockGroupGrid onAdd={onAdd} query={query} category={category} />
      </div>
    </div>
  );
}
