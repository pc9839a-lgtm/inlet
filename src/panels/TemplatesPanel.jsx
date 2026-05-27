import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import PreviewRenderer from '../preview/LandingRenderer.jsx';
import { createTemplatePage } from '../templates/landingTemplates.js';

export default function TemplatesPanel({ page, templates = [], onApply }) {
  const safeTemplates = templates.filter(Boolean);
  const [index, setIndex] = useState(0);
  const selected = safeTemplates[index] || safeTemplates[0];

  const previewPage = useMemo(() => {
    if (!selected) return page;
    return createTemplatePage(selected.id, page);
  }, [page, selected]);

  const move = (amount) => {
    if (!safeTemplates.length) return;
    setIndex((current) => (current + amount + safeTemplates.length) % safeTemplates.length);
  };

  if (!selected) {
    return (
      <section className="template-browser empty">
        <strong>선택 가능한 템플릿이 없습니다.</strong>
      </section>
    );
  }

  return (
    <section className="template-browser template-browser-preview">
      <div className="template-browser-head">
        <div>
          <span>템플릿 선택</span>
          <h2>목적에 맞는 실전 랜딩을 고르세요</h2>
          <p>상담, 방문 예약, 견적 문의에 맞춰 편집 가능한 블록으로 구성한 템플릿입니다.</p>
        </div>
        <button type="button" onClick={() => onApply?.(selected.id)}>
          템플릿 적용
        </button>
      </div>

      <div className="template-preview-layout">
        <aside className="template-rail" aria-label="템플릿 목록">
          {safeTemplates.map((template, itemIndex) => (
            <button
              type="button"
              key={template.id}
              className={itemIndex === index ? 'active' : ''}
              onClick={() => setIndex(itemIndex)}
            >
              <strong>{template.name}</strong>
              <span className="template-rail-summary">{template.summary}</span>
              <span className="template-rail-chips">
                {(template.chips || []).slice(0, 3).map((chip) => <em key={chip}>{chip}</em>)}
              </span>
            </button>
          ))}
        </aside>

        <div className="template-stage template-stage-phone-only" key={selected.id}>
          <button
            type="button"
            className="template-slide-btn"
            aria-label="이전 템플릿"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>

          <div className="template-phone-preview" aria-label={`${selected.name} 미리보기`}>
            <PreviewRenderer
              page={previewPage}
              leads={[]}
              addLead={() => {}}
              track={() => {}}
              templatePreview
            />
          </div>

          <button
            type="button"
            className="template-slide-btn"
            aria-label="다음 템플릿"
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
import './TemplatesPanel.css';
