import React from 'react';
import { Layers3, Plus } from 'lucide-react';
import { getSectionPatterns } from './sectionPatternCatalog.js';

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, '');
}

function matches(pattern, query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return normalizeSearch([
    pattern.label,
    pattern.description,
    pattern.industry,
    ...(pattern.tags || []),
  ].filter(Boolean).join(' ')).includes(normalized);
}

function PatternCard({ pattern, onAddPattern }) {
  return (
    <button
      type="button"
      className="section-pattern-card"
      onClick={() => onAddPattern(pattern.id)}
      aria-label={`${pattern.label} 섹션 추가`}
    >
      <span className="section-pattern-icon" aria-hidden="true"><Layers3 size={17} /></span>
      <span className="section-pattern-copy">
        <strong>{pattern.label}</strong>
        <small>{pattern.description}</small>
        <span className="section-pattern-tags">
          {(pattern.tags || []).slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}
        </span>
      </span>
      <span className="section-pattern-add" aria-hidden="true"><Plus size={16} /></span>
    </button>
  );
}

export function AddSectionPatternGrid({ mode = 'recommended', query = '', onAddPattern }) {
  const patterns = getSectionPatterns(mode === 'industry' ? 'industry' : 'recommended').filter((pattern) => matches(pattern, query));

  if (!patterns.length) {
    return <div className="widget-add-empty" role="status">조건에 맞는 섹션이 없습니다.</div>;
  }

  if (mode !== 'industry') {
    return (
      <div className="section-pattern-grid">
        {patterns.map((pattern) => <PatternCard key={pattern.id} pattern={pattern} onAddPattern={onAddPattern} />)}
      </div>
    );
  }

  const industries = [...new Set(patterns.map((pattern) => pattern.industry).filter(Boolean))];

  return (
    <div className="section-pattern-industry-groups">
      {industries.map((industry) => (
        <section key={industry} className="section-pattern-industry-group">
          <div className="section-pattern-group-title">
            <strong>{industry}</strong>
            <span>업종에 맞는 기본 전환 흐름</span>
          </div>
          <div className="section-pattern-grid">
            {patterns.filter((pattern) => pattern.industry === industry).map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} onAddPattern={onAddPattern} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
