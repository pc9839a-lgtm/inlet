import React, { useMemo } from 'react';
import { conversionCockpitModel } from './conversionCockpitModel.js';
import './ConversionCockpit.css';

function StatusItem({ label, value, title = '' }) {
  return (
    <span className="conversion-cockpit-status" title={title || `${label} ${value}`}>
      <b>{label}</b>
      <strong>{value}</strong>
    </span>
  );
}

export default function ConversionCockpit({
  page,
  leads,
  previewUrl,
  onOpenInbox,
  onOpenStats,
}) {
  const model = useMemo(
    () => conversionCockpitModel({ page, leads, previewUrl }),
    [leads, page, previewUrl],
  );

  return (
    <section className="conversion-cockpit" data-editor-cockpit="conversion" aria-label="문의 전환 점검">
      <div className="conversion-cockpit-statuses">
        <StatusItem label="문의" value={model.inquiryCount ? `${model.inquiryCount}개` : '없음'} />
        <StatusItem label="전달" value={`${model.destinationCount}곳`} title={model.destinations.join(', ')} />
        <StatusItem label="추적" value={model.trackingCount ? `${model.trackingCount}개` : '미설정'} title={model.tracking.join(', ')} />
        <StatusItem label="실문의" value={`${model.liveLeadCount}건`} />
      </div>

      <div className="conversion-cockpit-actions">
        {model.canTest ? (
          <a
            className="conversion-cockpit-test"
            data-testid="conversion-test-link"
            href={model.testUrl}
            target="_blank"
            rel="noreferrer"
          >
            테스트 문의
          </a>
        ) : (
          <button type="button" className="conversion-cockpit-test" disabled>문의폼 없음</button>
        )}
        {onOpenInbox ? <button type="button" onClick={onOpenInbox}>접수함</button> : null}
        {onOpenStats ? <button type="button" onClick={onOpenStats}>통계</button> : null}
        {model.testLeadCount > 0 ? <span className="conversion-cockpit-test-count">테스트 {model.testLeadCount}</span> : null}
      </div>
    </section>
  );
}
