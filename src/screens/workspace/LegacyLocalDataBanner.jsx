import React, { useEffect, useState } from 'react';
import { isServerLeadMode } from '../../config/runtimeConfig.js';
import { buildLegacyLocalArchive, inspectLegacyLocalData } from '../../lib/legacyLocalMigration.js';
import './LegacyLocalDataBanner.css';

function readSummary() {
  if (typeof window === 'undefined') return { items: [], total: 0, needsAttention: false, hasErrors: false };
  return inspectLegacyLocalData(window.localStorage);
}

export default function LegacyLocalDataBanner({ authUser = null }) {
  const [summary, setSummary] = useState(readSummary);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isServerLeadMode() || !authUser) return undefined;
    const refresh = () => setSummary(readSummary());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [authUser?.session, authUser?.ownerId]);

  if (!isServerLeadMode() || !authUser || !summary.needsAttention) return null;

  const downloadBackup = () => {
    try {
      const archive = buildLegacyLocalArchive(window.localStorage);
      const file = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pagero-local-recovery-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); URL.revokeObjectURL(url); }
      setError('');
    } catch (cause) {
      setError(String(cause?.message || '로컬 백업 파일 생성에 실패했습니다.'));
    }
  };

  const leadCount = summary.items.find(item => item.kind === 'leads')?.count || 0;
  const eventCount = summary.items.find(item => item.kind === 'events')?.count || 0;
  return (
    <section className="pagero-legacy-data-banner" aria-label="브라우저 데이터 이전 안내">
      <div className="pagero-legacy-data-copy">
        <strong>이전 브라우저 데이터가 남아 있습니다</strong>
        <p>접수 {leadCount}건 · 이벤트 {eventCount}건{summary.hasErrors ? ' · 읽기 오류 또는 형식 확인 필요' : ''}</p>
        <small>서버 데이터와 자동 병합하지 않습니다. 먼저 백업 파일을 저장하세요. 다른 페이지의 데이터가 포함됐을 수 있으므로 이관 전 확인이 필요합니다.</small>
        {error ? <small role="alert" className="pagero-legacy-data-error">{error}</small> : null}
      </div>
      <button type="button" onClick={downloadBackup}>로컬 원본 백업 (JSON)</button>
    </section>
  );
}
