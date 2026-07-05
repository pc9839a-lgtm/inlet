import { useEffect, useMemo, useState } from 'react';
import {
  fmtDate,
  LEAD_STATUS,
  leadKind,
  leadKindLabel,
  leadPrimaryContact,
  leadSearchText,
  normalizeLeadItem,
} from '../lib/leadModel.js';
import { currentMonthValue, monthDateRange } from '../lib/monthRange.js';
import { trafficSourceLabel } from '../lib/trafficAttribution.js';
import InboxConnectionsPanel from './inbox/InboxConnectionsPanel.jsx';
import IntakeDuplicatePolicyPanel from './inbox/DuplicatePolicyPanel.jsx';
import {
  fmtDateOnly,
  isDuplicateLeadAnswer,
  leadInDateRange,
  leadReferrer,
  leadSourceUrl,
  leadUtmText,
} from './inbox/leadHelpers.js';
import './InboxPanel.css';

function LeadInfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="lead-info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function DebouncedMemoInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => setDraft(value || ''), [value]);
  useEffect(() => {
    if ((value || '') === draft) return undefined;
    const timer = window.setTimeout(() => onCommit(draft), 650);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit, value]);

  return (
    <input
      placeholder="메모를 입력하세요"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if ((value || '') !== draft) onCommit(draft);
      }}
    />
  );
}

function StatusPills({ value, onChange }) {
  return (
    <div className="status-pill-row">
      {LEAD_STATUS.map((item) => (
        <button key={item} type="button" className={value === item ? 'active' : ''} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function LeadSource({ lead }) {
  const label = trafficSourceLabel(lead);
  const url = leadSourceUrl(lead);
  return (
    <span className="lead-source-label" title={url || label}>
      유입: {label}
    </span>
  );
}

function LeadConflictNotice({ conflict, onReload, onRetry, onDismiss }) {
  if (!conflict) return null;
  return (
    <section className="lead-conflict-notice" role="status">
      <div>
        <strong>접수 데이터 충돌</strong>
        <span>{conflict.message || '다른 화면에서 먼저 수정된 접수입니다.'}</span>
      </div>
      <div className="lead-conflict-actions">
        <button type="button" onClick={onReload}>최신 목록</button>
        <button type="button" onClick={onRetry}>다시 시도</button>
        <button type="button" className="ghost" onClick={onDismiss}>닫기</button>
      </div>
    </section>
  );
}

export default function InboxPanel({
  leads,
  page,
  authUser = null,
  updatePage,
  syncing = false,
  totalLeads = 0,
  hasMoreLeads = false,
  loadMoreLeads,
  onReloadLeads,
  onFiltersChange,
  updateIntegrations,
  onSavePage,
  updateLead,
  deleteLead,
  exportLeadsCsv,
  leadConflict,
  onReloadLeadConflict,
  onRetryLeadConflict,
  onDismissLeadConflict,
}) {
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(currentMonthValue());
  const [openId, setOpenId] = useState('');
  const [copyFallback, setCopyFallback] = useState(null);
  const selectedMonthRange = useMemo(() => monthDateRange(month), [month]);
  const updateLeadSafe = updateLead || (() => {});
  const reloadLeads = onReloadLeads || onReloadLeadConflict || (() => {});
  const retryLeadSave = onRetryLeadConflict || (() => {});
  const loadMore = loadMoreLeads || (() => {});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onFiltersChange?.({ kind: filter, status: statusFilter, deliveryStatus: 'all', q: query.trim(), month });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filter, month, onFiltersChange, query, statusFilter]);

  const { normalized, consultCount, reservationCount, newCount, filtered } = useMemo(() => {
    const items = (leads || []).map(normalizeLeadItem);
    const q = query.trim().toLowerCase();
    let consult = 0;
    let reservation = 0;
    let fresh = 0;
    const visible = [];

    items.forEach((lead) => {
      const kind = leadKind(lead);
      if (!leadInDateRange(lead, selectedMonthRange)) return;
      if (kind === 'reservation') reservation += 1;
      else consult += 1;
      if (lead.status === '신규') fresh += 1;
      if (filter !== 'all' && kind !== filter) return;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return;
      if (q && !leadSearchText(lead).includes(q)) return;
      visible.push(lead);
    });

    return { normalized: items, consultCount: consult, reservationCount: reservation, newCount: fresh, filtered: visible };
  }, [filter, leads, query, selectedMonthRange, statusFilter]);

  const loadedCount = normalized.length;
  const serverTotal = Number(totalLeads || loadedCount);
  const displaySummary = serverTotal > loadedCount
    ? `${filtered.length}건 표시 · 서버 ${serverTotal}건 중 ${loadedCount}건 로드`
    : `${filtered.length}건 표시`;

  const copyLead = async (lead) => {
    const answers = Array.isArray(lead.answers)
      ? lead.answers.map((item) => `${item.label || item.name || '질문'}: ${item.value || '-'}`).join('\n')
      : '';
    const text = [
      `이름: ${lead.name || '-'}`,
      `연락처: ${leadPrimaryContact(lead) || '-'}`,
      lead.email ? `이메일: ${lead.email}` : '',
      lead.message ? `문의: ${lead.message}` : '',
      `유입 채널: ${trafficSourceLabel(lead)}`,
      leadSourceUrl(lead) ? `유입 URL: ${leadSourceUrl(lead)}` : '',
      leadReferrer(lead) ? `Referrer: ${leadReferrer(lead)}` : '',
      leadUtmText(lead) ? `UTM: ${leadUtmText(lead)}` : '',
      answers,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback(null);
    } catch {
      setCopyFallback({ id: lead.id, text });
    }
  };

  return (
    <div className="simple-panel inbox-panel inbox-v2 inbox-v3 inbox-service">
      <IntakeDuplicatePolicyPanel page={page} authUser={authUser} updatePage={updatePage} />
      <section className="inbox-summary-v2 inbox-summary-v3">
        <article>
          <span>전체 접수</span>
          <strong>{loadedCount}</strong>
        </article>
        <article>
          <span>상담</span>
          <strong>{consultCount}</strong>
        </article>
        <article>
          <span>예약</span>
          <strong>{reservationCount}</strong>
        </article>
        <article>
          <span>신규</span>
          <strong>{newCount}</strong>
        </article>
      </section>

      <LeadConflictNotice conflict={leadConflict} onReload={reloadLeads} onRetry={retryLeadSave} onDismiss={onDismissLeadConflict} />

      <section className="card inbox-toolbar-card inbox-toolbar-v3">
        <div className="section-title">
          <span>접수 검색</span>
          <b>{displaySummary}</b>
        </div>
        <div className="inbox-toolbar">
          <label>
            <span>검색</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 연락처, 문의 내용" />
          </label>
          <label>
            <span>월</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
          </label>
          <label>
            <span>유형</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">전체</option>
              <option value="consult">상담</option>
              <option value="reservation">예약</option>
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">전체</option>
              {LEAD_STATUS.map((item) => (
                <option key={typeof item === 'string' ? item : item.value} value={typeof item === 'string' ? item : item.value}>{typeof item === 'string' ? item : item.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn secondary" onClick={reloadLeads} disabled={syncing}>새로고침</button>
          {exportLeadsCsv ? <button type="button" className="btn secondary" onClick={() => exportLeadsCsv({ month })}>CSV 내보내기</button> : null}
        </div>
      </section>

      <section className="card inbox-list-card inbox-list-v3">
        <div className="section-title inbox-list-title">
          <span>접수 목록</span>
          <div className="inbox-list-actions">
            {hasMoreLeads ? <button type="button" className="btn secondary" onClick={loadMore} disabled={syncing}>더보기</button> : null}
          </div>
        </div>

        {syncing ? <div className="inbox-sync-note">접수함을 불러오는 중입니다.</div> : null}
        {!filtered.length ? (
          <div className="empty-state">조건에 맞는 접수가 없습니다.</div>
        ) : (
          <div className="lead-list-v3 lead-list-service">
            <div className="lead-table-head" aria-hidden="true">
              <span>번호</span>
              <span>유형</span>
              <span>이름</span>
              <span>연락처</span>
              <span>날짜</span>
              <span>상세</span>
            </div>
            {filtered.map((lead, index) => {
              const opened = openId === lead.id;
              const answers = Array.isArray(lead.answers) ? lead.answers.filter((item) => !isDuplicateLeadAnswer(item, lead)) : [];
              return (
                <article className={`lead-card-v3 lead-card-service ${opened ? 'open' : ''}`} key={lead.id}>
                  <div className="lead-row-service">
                    <span>#{index + 1}</span>
                    <b>{leadKindLabel(lead)}</b>
                    <strong>{lead.name || '이름 없음'}</strong>
                    <em>{leadPrimaryContact(lead) || '-'}</em>
                    <small>{fmtDateOnly(lead.createdAt)}</small>
                    <button type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>{opened ? '닫기' : '상세'}</button>
                  </div>

                  {opened ? (
                    <div className="lead-detail-service">
                      <section>
                        <h4>고객 정보</h4>
                        <LeadInfoRow label="접수 유형" value={leadKindLabel(lead)} />
                        <LeadInfoRow label="접수 일시" value={fmtDate(lead.createdAt)} />
                        <LeadInfoRow label="이름" value={lead.name} />
                        <LeadInfoRow label="연락처" value={leadPrimaryContact(lead)} />
                        <LeadInfoRow label="이메일" value={lead.email} />
                      </section>

                      {lead.message ? (
                        <section>
                          <h4>문의 내용</h4>
                          <p>{lead.message}</p>
                        </section>
                      ) : null}

                      {answers.length ? (
                        <section>
                          <h4>질문 답변</h4>
                          <div className="lead-answer-list">
                            {answers.map((item, answerIndex) => (
                              <LeadInfoRow key={`${lead.id}-answer-${answerIndex}`} label={item.label || item.name || `질문 ${answerIndex + 1}`} value={item.value} />
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <section>
                        <h4>유입 정보</h4>
                        <LeadSource lead={lead} />
                        <LeadInfoRow label="유입 URL" value={leadSourceUrl(lead)} />
                        <LeadInfoRow label="Referrer" value={leadReferrer(lead)} />
                        <LeadInfoRow label="UTM" value={leadUtmText(lead)} />
                        <LeadInfoRow label="페이지" value={lead.pageSlug || lead.project} />
                        <LeadInfoRow label="기기" value={lead.deviceType} />
                      </section>

                      <section>
                        <h4>관리</h4>
                        <StatusPills value={lead.status || '신규'} onChange={(status) => updateLeadSafe(lead.id, { status })} />
                        <DebouncedMemoInput value={lead.memo || ''} onCommit={(memo) => updateLeadSafe(lead.id, { memo })} />
                      </section>

                      <div className="lead-detail-actions-service">
                        <button type="button" className="btn secondary" onClick={() => copyLead(lead)}>복사</button>
                        {deleteLead ? <button type="button" className="btn secondary danger" onClick={() => deleteLead(lead.id)}>삭제</button> : null}
                        <button type="button" className="btn primary" onClick={() => setOpenId('')}>닫기</button>
                      </div>
                      {copyFallback?.id === lead.id ? (
                        <section className="lead-copy-fallback" aria-live="polite">
                          <h4>복사할 내용</h4>
                          <textarea readOnly value={copyFallback.text} onFocus={(event) => event.currentTarget.select()} />
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <InboxConnectionsPanel page={page} authUser={authUser} updateIntegrations={updateIntegrations} onSavePage={onSavePage} />
    </div>
  );
}
