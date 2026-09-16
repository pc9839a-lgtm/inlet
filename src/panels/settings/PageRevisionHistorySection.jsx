import { useEffect, useMemo, useState } from 'react';
import { fetchPageRevisions } from '../../lib/pageRepository.js';
import { pageFromRevisionDraft, revisionSummary } from '../../lib/pageRevisionRestore.js';
import SettingsSection from './SettingsSection.jsx';

function formatRevisionDate(value = '') {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '시간 정보 없음';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
}

export default function PageRevisionHistorySection({ page, authUser, setPage }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoredRevision, setRestoredRevision] = useState(0);

  const pageIdentity = useMemo(
    () => `${page?.projectId || ''}:${page?.slug || ''}:${page?.id || page?.pageId || ''}:${page?.revision || 0}`,
    [page?.projectId, page?.slug, page?.id, page?.pageId, page?.revision],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchPageRevisions(page, authUser)
      .then((items) => {
        if (!alive) return;
        setRevisions(Array.isArray(items) ? items : []);
      })
      .catch((reason) => {
        if (!alive) return;
        setRevisions([]);
        setError(String(reason?.message || reason || '저장 이력을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [pageIdentity, authUser?.session]);

  const restoreToEditor = (revision) => {
    const summary = revisionSummary(revision);
    if (!revision?.page) return;
    const confirmed = window.confirm(
      `버전 ${summary.revision || '-'}을 현재 편집본으로 불러올까요?\n\n저장 버튼을 누르기 전까지 공개 페이지는 변경되지 않습니다.`,
    );
    if (!confirmed) return;
    setPage(pageFromRevisionDraft(page, revision));
    setRestoredRevision(summary.revision || -1);
  };

  return (
    <SettingsSection id="history" className="settings-flat-section page-revision-history-section">
      <div className="settings-flat-block page-revision-history-intro">
        <strong>저장 버전</strong>
        <span className="settings-flat-value">과거 저장본을 현재 편집본으로 불러옵니다. 공개 페이지는 다시 저장하기 전까지 바뀌지 않습니다.</span>
      </div>

      {restoredRevision !== 0 && (
        <div className="settings-flat-block page-revision-history-notice" role="status">
          <strong>버전 {restoredRevision > 0 ? restoredRevision : '-'} 불러옴</strong>
          <span className="settings-flat-value">내용을 확인한 뒤 저장하면 현재 공개 페이지에 반영됩니다.</span>
        </div>
      )}

      {loading && (
        <div className="settings-flat-block"><span className="settings-flat-value">저장 이력을 불러오는 중입니다.</span></div>
      )}

      {!loading && error && (
        <div className="settings-flat-block page-revision-history-error" role="alert">
          <strong>저장 이력을 불러오지 못했습니다.</strong>
          <span className="settings-flat-value">{error}</span>
        </div>
      )}

      {!loading && !error && revisions.length === 0 && (
        <div className="settings-flat-block"><span className="settings-flat-value">아직 저장된 이전 버전이 없습니다.</span></div>
      )}

      {!loading && !error && revisions.map((revision) => {
        const summary = revisionSummary(revision);
        const current = summary.revision === Number(page?.revision || 0);
        return (
          <div className="settings-flat-block settings-flat-row page-revision-history-row" key={summary.id || `${summary.revision}-${summary.timestamp}`}>
            <div>
              <strong>버전 {summary.revision || '-'}</strong>
              <span className="settings-flat-value">{formatRevisionDate(summary.timestamp)} · 블록 {summary.blockCount}개{summary.title ? ` · ${summary.title}` : ''}</span>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => restoreToEditor(revision)}
              disabled={current || !revision?.page}
            >
              {current ? '현재 버전' : '불러오기'}
            </button>
          </div>
        );
      })}
    </SettingsSection>
  );
}
