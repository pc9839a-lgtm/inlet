import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Inbox as InboxIcon,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
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
import './InboxOperations.css';

const PROCESSING_STATUSES = new Set(['확인중', '보류']);
const DONE_STATUSES = new Set(['연락완료', '예약완료', '종료']);

function LeadInfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="lead-info-row inbox-ops-info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

const DUPLICATE_REASON_LABELS = {
  phone_30d: '연락처 중복',
  email_30d: '이메일 중복',
  client_repeat_30m: '반복 제출',
  spam_suspected: '과다 제출 의심',
};

function leadRiskInfo(lead = {}) {
  const score = Math.max(0, Number(lead.riskScore || 0));
  const reasons = String(lead.duplicateReason || '')
    .split(',')
    .map((reason) => reason.trim())
    .filter(Boolean)
    .map((reason) => DUPLICATE_REASON_LABELS[reason] || '기타 중복 신호');
  const uniqueReasons = [...new Set(reasons)];
  const flagged = !!lead.duplicate || score > 0 || uniqueReasons.length > 0;
  if (!flagged) return null;
  return {
    score,
    reasons: uniqueReasons,
    level: score >= 70 ? 'danger' : 'warning',
    badge: score >= 70 ? '주의' : '중복',
  };
}

function leadDeliveryInfo(lead = {}) {
  const status = String(lead.delivery?.status || lead.deliveryStatus || 'none');
  if (!['failed', 'partial'].includes(status)) return null;
  return {
    label: status === 'failed' ? '알림 실패' : '일부 실패',
    summary: lead.delivery?.summary || '연결된 알림 전송을 확인해주세요.',
  };
}

function statusTone(status = '') {
  if (DONE_STATUSES.has(status)) return 'done';
  if (PROCESSING_STATUSES.has(status)) return 'processing';
  return 'new';
}

function isSameLocalDate(value, base = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === base.getFullYear()
    && date.getMonth() === base.getMonth()
    && date.getDate() === base.getDate();
}

function queueMatches(lead, queueFilter) {
  if (queueFilter === 'new') return lead.status === '신규';
  if (queueFilter === 'processing') return PROCESSING_STATUSES.has(lead.status);
  if (queueFilter === 'done') return DONE_STATUSES.has(lead.status);
  if (queueFilter === 'risk') return !!leadRiskInfo(lead);
  return true;
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
    <textarea
      rows={4}
      placeholder="메모를 입력하세요."
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
    <div className="status-pill-row inbox-ops-status-pills">
      {LEAD_STATUS.map((item) => (
        <button
          key={item}
          type="button"
          className={`${value === item ? 'active' : ''} tone-${statusTone(item)}`}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`inbox-ops-status-badge ${statusTone(status)}`}>{status || '신규'}</span>;
}

function LeadSource({ lead }) {
  const label = trafficSourceLabel(lead);
  const url = leadSourceUrl(lead);
  return (
    <span className="lead-source-label inbox-ops-source-label" title={url || label}>
      {label}
    </span>
  );
}

function LeadConflictNotice({ conflict, onReload, onRetry, onDismiss }) {
  if (!conflict) return null;
  return (
    <section className="lead-conflict-notice inbox-ops-conflict" role="status">
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

function SidebarItem({ active, icon: Icon, label, count, onClick }) {
  return (
    <button type="button" className={`inbox-ops-side-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
      {Number.isFinite(Number(count)) ? <b>{count}</b> : null}
    </button>
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
  retryLeadDelivery,
  retryFailedDeliveries,
  exportLeadsCsv,
  leadConflict,
  onReloadLeadConflict,
  onRetryLeadConflict,
  onDismissLeadConflict,
}) {
  const rootRef = useRef(null);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(currentMonthValue());
  const [openId, setOpenId] = useState('');
  const [sectionMode, setSectionMode] = useState('leads');
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

  const {
    normalized,
    monthItems,
    consultCount,
    reservationCount,
    newCount,
    processingCount,
    doneCount,
    riskCount,
    todayNewCount,
    filtered,
  } = useMemo(() => {
    const items = (leads || []).map(normalizeLeadItem);
    const q = query.trim().toLowerCase();
    const monthScoped = items.filter((lead) => leadInDateRange(lead, selectedMonthRange));
    let consult = 0;
    let reservation = 0;
    let fresh = 0;
    let processing = 0;
    let done = 0;
    let risk = 0;
    let todayFresh = 0;
    const visible = [];

    monthScoped.forEach((lead) => {
      const kind = leadKind(lead);
      if (kind === 'reservation') reservation += 1;
      else consult += 1;
      if (lead.status === '신규') {
        fresh += 1;
        if (isSameLocalDate(lead.createdAt)) todayFresh += 1;
      }
      if (PROCESSING_STATUSES.has(lead.status)) processing += 1;
      if (DONE_STATUSES.has(lead.status)) done += 1;
      if (leadRiskInfo(lead)) risk += 1;
      if (!queueMatches(lead, queueFilter)) return;
      if (filter !== 'all' && kind !== filter) return;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return;
      if (q && !leadSearchText(lead).includes(q)) return;
      visible.push(lead);
    });

    return {
      normalized: items,
      monthItems: monthScoped,
      consultCount: consult,
      reservationCount: reservation,
      newCount: fresh,
      processingCount: processing,
      doneCount: done,
      riskCount: risk,
      todayNewCount: todayFresh,
      filtered: visible,
    };
  }, [filter, leads, query, queueFilter, selectedMonthRange, statusFilter]);

  useEffect(() => {
    if (sectionMode !== 'leads') return;
    if (!filtered.length) {
      if (openId) setOpenId('');
      return;
    }
    if (!openId || !filtered.some((lead) => lead.id === openId)) setOpenId(filtered[0].id);
  }, [filtered, openId, sectionMode]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || sectionMode !== 'leads') return undefined;
    const frame = window.requestAnimationFrame(() => {
      root.querySelectorAll('.inbox-ops-table-row').forEach((row) => {
        row.classList.toggle('lead-card-service', row.getClientRects().length > 0);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filtered, sectionMode]);

  const selectedLead = useMemo(
    () => filtered.find((lead) => lead.id === openId) || null,
    [filtered, openId],
  );
  const selectedAnswers = selectedLead && Array.isArray(selectedLead.answers)
    ? selectedLead.answers.filter((item) => !isDuplicateLeadAnswer(item, selectedLead))
    : [];
  const riskInfo = selectedLead ? leadRiskInfo(selectedLead) : null;
  const selectedDeliveryInfo = selectedLead ? leadDeliveryInfo(selectedLead) : null;
  const loadedCount = normalized.length;
  const failedDeliveryCount = normalized.filter((lead) => leadDeliveryInfo(lead)).length;
  const serverTotal = Number(totalLeads || loadedCount);
  const hasPartialLeadList = serverTotal > loadedCount;
  const totalSummaryLabel = hasPartialLeadList ? '서버 전체 접수' : '현재 접수';
  const loadedScopeLabel = hasPartialLeadList
    ? `${loadedCount}건 불러옴 · 현재 조건 ${filtered.length}건`
    : `현재 조건 ${filtered.length}건`;
  const displaySummary = hasPartialLeadList
    ? `${filtered.length}건 표시 · 서버 ${serverTotal}건 중 ${loadedCount}건 로드`
    : `${filtered.length}건 표시`;

  const chooseQueue = (nextQueue) => {
    setSectionMode('leads');
    setQueueFilter(nextQueue);
    setStatusFilter('all');
  };

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
    <div ref={rootRef} className={`simple-panel inbox-panel inbox-ops-root mode-${sectionMode}`}>
      <div className="inbox-ops-layout">
        <aside className="inbox-ops-sidebar">
          <div className="inbox-ops-sidebar-title">
            <span>접수함</span>
            <small>{monthItems.length}건</small>
          </div>

          <nav className="inbox-ops-side-nav" aria-label="접수 상태">
            <SidebarItem active={sectionMode === 'leads' && queueFilter === 'all'} icon={InboxIcon} label="전체 문의" count={serverTotal} onClick={() => chooseQueue('all')} />
            <SidebarItem active={sectionMode === 'leads' && queueFilter === 'new'} icon={InboxIcon} label="신규" count={newCount} onClick={() => chooseQueue('new')} />
            <SidebarItem active={sectionMode === 'leads' && queueFilter === 'processing'} icon={Clock3} label="처리중" count={processingCount} onClick={() => chooseQueue('processing')} />
            <SidebarItem active={sectionMode === 'leads' && queueFilter === 'done'} icon={CheckCircle2} label="완료" count={doneCount} onClick={() => chooseQueue('done')} />
            <SidebarItem active={sectionMode === 'leads' && queueFilter === 'risk'} icon={Ban} label="스팸·중복" count={riskCount} onClick={() => chooseQueue('risk')} />
          </nav>

          <div className="inbox-ops-side-divider" />
          <span className="inbox-ops-side-label">관리</span>
          <nav className="inbox-ops-side-nav secondary" aria-label="접수함 관리">
            <SidebarItem active={sectionMode === 'duplicate'} icon={SlidersHorizontal} label="중복 정책" onClick={() => setSectionMode('duplicate')} />
            <SidebarItem active={sectionMode === 'connections'} icon={Settings2} label="외부 연동" onClick={() => setSectionMode('connections')} />
          </nav>

          <div className="inbox-ops-side-mini">
            <span>상담 <b>{consultCount}</b></span>
            <span>예약 <b>{reservationCount}</b></span>
          </div>
        </aside>

        {sectionMode === 'leads' ? (
          <>
            <main className="inbox-ops-main">
              <header className="inbox-ops-main-head">
                <div>
                  <small>고객 문의 관리</small>
                  <h2>접수함</h2>
                </div>
                <div className="inbox-ops-total-summary" title={displaySummary}>
                  <strong>{serverTotal}</strong>
                  <span>{totalSummaryLabel} · {loadedScopeLabel}</span>
                </div>
              </header>

              <section className="inbox-ops-kpis" aria-label="접수 요약">
                <article>
                  <span>오늘 신규</span>
                  <strong>{todayNewCount}</strong>
                  <InboxIcon size={18} />
                </article>
                <article>
                  <span>처리중</span>
                  <strong>{processingCount}</strong>
                  <Clock3 size={18} />
                </article>
                <article>
                  <span>완료</span>
                  <strong>{doneCount}</strong>
                  <CheckCircle2 size={18} />
                </article>
              </section>

              <LeadConflictNotice conflict={leadConflict} onReload={reloadLeads} onRetry={retryLeadSave} onDismiss={onDismissLeadConflict} />

              <section className="inbox-ops-toolbar">
                <label className="inbox-ops-search">
                  <Search size={18} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 연락처, 문의 내용을 검색하세요" />
                </label>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} aria-label="조회 월" />
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  aria-label="접수 유형"
                >
                  <option value="all">유형 전체</option>
                  <option value="consult">상담</option>
                  <option value="reservation">예약</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setQueueFilter('all');
                  }}
                  aria-label="상태"
                >
                  <option value="all">상태 전체</option>
                  {LEAD_STATUS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <button type="button" className="inbox-ops-icon-button" onClick={reloadLeads} disabled={syncing} title="새로고침">
                  <RefreshCw size={18} />
                </button>
                {exportLeadsCsv ? (
                  <button
                    type="button"
                    className="inbox-ops-toolbar-button"
                    onClick={() => exportLeadsCsv(filtered, {
                      month,
                      kind: filter,
                      status: statusFilter,
                      deliveryStatus: 'all',
                      q: query.trim(),
                    })}
                  >
                    <Download size={17} /> CSV 내보내기
                  </button>
                ) : null}
              </section>

              {failedDeliveryCount > 0 && retryFailedDeliveries ? (
                <button type="button" className="inbox-ops-retry-banner" onClick={retryFailedDeliveries} disabled={syncing}>
                  알림 전송 실패 {failedDeliveryCount}건 다시 보내기
                </button>
              ) : null}

              <section className="inbox-ops-table-card">
                <div className="inbox-ops-table-head" aria-hidden="true">
                  <span>이름</span>
                  <span>연락처</span>
                  <span>유입 페이지</span>
                  <span>접수시간</span>
                  <span>상태</span>
                </div>

                {syncing ? <div className="inbox-ops-empty">접수함을 불러오는 중입니다.</div> : null}
                {!syncing && !filtered.length ? <div className="inbox-ops-empty">조건에 맞는 접수가 없습니다.</div> : null}

                <div className="inbox-ops-table-body">
                  {filtered.map((lead) => {
                    const riskInfo = leadRiskInfo(lead);
                    const deliveryInfo = leadDeliveryInfo(lead);
                    const selected = lead.id === openId;
                    return (
                      <article
                        key={lead.id}
                        role="button"
                        tabIndex={0}
                        className={`inbox-ops-table-row ${selected ? 'selected' : ''}`}
                        onClick={() => setOpenId(lead.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') setOpenId(lead.id);
                        }}
                      >
                        <span className="inbox-ops-name-cell">
                          <strong>{lead.name || '이름 없음'}</strong>
                          <small>{leadKindLabel(lead)}</small>
                          {riskInfo ? <i className={`inbox-ops-mini-badge lead-risk-badge ${riskInfo.level}`}>{riskInfo.badge}</i> : null}
                          {deliveryInfo ? <i className="inbox-ops-mini-badge lead-delivery-badge delivery">{deliveryInfo.label}</i> : null}
                        </span>
                        <span>{leadPrimaryContact(lead) || '-'}</span>
                        <span>{lead.pageTitle || lead.pageSlug || lead.project || page.title || '-'}</span>
                        <span>{fmtDateOnly(lead.createdAt)}</span>
                        <StatusBadge status={lead.status} />
                      </article>
                    );
                  })}
                </div>

                <footer className="inbox-ops-table-footer">
                  <span>{filtered.length} / {serverTotal}건</span>
                  {hasMoreLeads ? <button type="button" onClick={loadMore} disabled={syncing}>더보기</button> : <b>마지막 목록입니다.</b>}
                </footer>
              </section>
            </main>

            <aside className="inbox-ops-detail">
              {!selectedLead ? (
                <div className="inbox-ops-detail-empty">
                  <InboxIcon size={28} />
                  <strong>문의를 선택하세요</strong>
                  <span>왼쪽 목록에서 문의를 선택하면 상세 내용이 표시됩니다.</span>
                </div>
              ) : (
                <>
                  <header className="inbox-ops-detail-head">
                    <div>
                      <small>문의 상세</small>
                      <h3>{selectedLead.name || '이름 없음'}</h3>
                      <span>{leadPrimaryContact(selectedLead) || '-'}</span>
                    </div>
                    <StatusBadge status={selectedLead.status} />
                  </header>

                  <section className="inbox-ops-detail-section compact">
                    <LeadInfoRow label="접수 시간" value={fmtDate(selectedLead.createdAt)} />
                    <LeadInfoRow label="접수 유형" value={leadKindLabel(selectedLead)} />
                    <LeadInfoRow label="유입 페이지" value={selectedLead.pageTitle || selectedLead.pageSlug || selectedLead.project || page.title} />
                    <LeadInfoRow label="이메일" value={selectedLead.email} />
                  </section>

                  {selectedLead.message ? (
                    <section className="inbox-ops-detail-section">
                      <h4>문의 내용</h4>
                      <p className="inbox-ops-message">{selectedLead.message}</p>
                    </section>
                  ) : null}

                  {selectedAnswers.length ? (
                    <section className="inbox-ops-detail-section">
                      <h4>질문 답변</h4>
                      <div className="inbox-ops-answer-list">
                        {selectedAnswers.map((item, answerIndex) => (
                          <LeadInfoRow key={`${selectedLead.id}-answer-${answerIndex}`} label={item.label || item.name || `질문 ${answerIndex + 1}`} value={item.value} />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="inbox-ops-detail-section">
                    <h4>메모</h4>
                    <DebouncedMemoInput value={selectedLead.memo || ''} onCommit={(memo) => updateLeadSafe(selectedLead.id, { memo })} />
                    <small className="inbox-ops-help">입력한 메모는 접수 데이터에 자동 저장됩니다.</small>
                  </section>

                  <section className="inbox-ops-detail-section">
                    <h4>유입 정보</h4>
                    <LeadSource lead={selectedLead} />
                    <LeadInfoRow label="유입 URL" value={leadSourceUrl(selectedLead)} />
                    <LeadInfoRow label="Referrer" value={leadReferrer(selectedLead)} />
                    <LeadInfoRow label="UTM" value={leadUtmText(selectedLead)} />
                    <LeadInfoRow label="기기" value={selectedLead.deviceType} />
                  </section>

                  {riskInfo ? (
                    <section className={`inbox-ops-detail-section warning ${riskInfo.level}`}>
                      <h4>중복·위험 신호</h4>
                      <LeadInfoRow label="판정" value={riskInfo.badge} />
                      <LeadInfoRow label="사유" value={riskInfo.reasons.join(', ') || '중복 접수로 표시됨'} />
                      <LeadInfoRow label="위험 점수" value={`${riskInfo.score}점`} />
                    </section>
                  ) : null}

                  {selectedDeliveryInfo ? (
                    <section className="inbox-ops-detail-section delivery-warning">
                      <h4>알림 전송</h4>
                      <LeadInfoRow label="상태" value={selectedDeliveryInfo.label} />
                      <LeadInfoRow label="결과" value={selectedDeliveryInfo.summary} />
                      {retryLeadDelivery ? <button type="button" onClick={() => retryLeadDelivery(selectedLead)}>다시 보내기</button> : null}
                    </section>
                  ) : null}

                  <section className="inbox-ops-detail-section status-section">
                    <h4>상태</h4>
                    <StatusPills value={selectedLead.status || '신규'} onChange={(status) => updateLeadSafe(selectedLead.id, { status })} />
                  </section>

                  <div className="inbox-ops-detail-actions">
                    <button type="button" className="secondary" onClick={() => copyLead(selectedLead)}>
                      <Copy size={17} /> 문의 복사
                    </button>
                    <button type="button" className="primary" onClick={() => updateLeadSafe(selectedLead.id, { status: '종료' })}>
                      <CheckCircle2 size={17} /> 완료 처리
                    </button>
                    {deleteLead ? (
                      <button type="button" className="danger" onClick={() => deleteLead(selectedLead.id)} title="접수 삭제">
                        <Trash2 size={17} />
                      </button>
                    ) : null}
                  </div>

                  {copyFallback?.id === selectedLead.id ? (
                    <section className="inbox-ops-copy-fallback lead-copy-fallback" aria-live="polite">
                      <h4>복사할 내용</h4>
                      <textarea readOnly value={copyFallback.text} onFocus={(event) => event.currentTarget.select()} />
                    </section>
                  ) : null}
                </>
              )}
            </aside>
          </>
        ) : (
          <main className="inbox-ops-management">
            <header>
              <small>접수함 관리</small>
              <h2>{sectionMode === 'duplicate' ? '중복 접수 정책' : '외부 연동'}</h2>
              <p>{sectionMode === 'duplicate' ? '반복 제출과 중복 연락처를 처리하는 기준을 설정합니다.' : '접수 데이터를 이메일, Google Sheets, Webhook으로 전달합니다.'}</p>
            </header>
            {sectionMode === 'duplicate'
              ? <IntakeDuplicatePolicyPanel page={page} authUser={authUser} updatePage={updatePage} />
              : <InboxConnectionsPanel page={page} authUser={authUser} updateIntegrations={updateIntegrations} onSavePage={onSavePage} />}
          </main>
        )}
      </div>
    </div>
  );
}
