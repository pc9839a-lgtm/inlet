import React from 'react';
import { Search } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { ADD_GROUPS } from './editorLabels.js';
import { AddBlockGroupGrid } from './AddBlockGroupGrid.jsx';

// The gallery is a front door to the existing block creation action.
// Every choice still uses the canonical block type and addBlock handler.
const QUICK_BLOCKS = [
  ['hero', '첫 화면', '대표 이미지와 핵심 메시지'],
  ['text', '글', '제목과 설명을 자유롭게'],
  ['image', '이미지', '사진 또는 갤러리'],
  ['links', '버튼 · 링크', '방문자를 원하는 곳으로'],
  ['form', '문의 폼', '고객 정보를 바로 접수'],
  ['reservation', '방문 예약', '날짜와 시간 선택'],
  ['youtube', '동영상', '영상으로 서비스 소개'],
  ['spacer', '여백', '콘텐츠 사이 간격'],
];

function QuickBlockPreview({ type }) {
  return (
    <span className={`editor-gallery-art editor-gallery-art--${type}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

export function AddBlockPanel({ onAdd }) {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const normalized = query.trim().toLocaleLowerCase();
  const quickBlocks = QUICK_BLOCKS.filter(([type, label, description]) => {
    if (!META[type]) return false;
    return !normalized || [label, description, META[type]?.label, type]
      .some((value) => String(value || '').toLocaleLowerCase().includes(normalized));
  });

  return (
    <div className="add-panel editor-block-gallery">
      <div className="editor-block-gallery-featured">
        <div className="editor-gallery-section-title">
          <h3>빠르게 추가</h3>
          <span>자주 사용하는 8가지 블록</span>
        </div>
        <div className="editor-gallery-quick-grid">
          {quickBlocks.map(([type, label, description]) => {
            const Icon = META[type].icon;
            return (
              <button key={type} type="button" className="editor-gallery-quick"
                onClick={() => onAdd(type)} aria-label={`${label} 블록 추가`}>
                <QuickBlockPreview type={type} />
                <span className="editor-gallery-quick-text">
                  <span className="editor-gallery-quick-title"><Icon size={17} aria-hidden="true" />{label}</span>
                  <small>{description}</small>
                </span>
              </button>
            );
          })}
          {normalized && !quickBlocks.length && <p className="editor-gallery-quick-empty">빠른 추가 항목이 없습니다.</p>}
        </div>
      </div>
      <div className="editor-block-gallery-all">
        <div className="editor-gallery-section-title"><h3>모든 블록</h3><span>기존 기능 그대로 사용</span></div>
        <div className="editor-gallery-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)}
            aria-label="추가할 블록 검색" placeholder="어떤 블록을 추가할까요?" />
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
