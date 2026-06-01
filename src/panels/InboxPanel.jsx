import { useEffect, useMemo, useState } from 'react';
import { normalizeIntegrations } from '../lib/pageModel.js';
import {
  connectionCounts,
  connectionState,
  deliveryStatusLabel,
} from '../lib/leadIntegrations.js';
import {
  fmtDate,
  LEAD_STATUS,
  leadKind,
  leadKindLabel,
  leadPrimaryContact,
  leadSearchText,
  normalizeLeadItem,
  statusClass,
} from '../lib/leadModel.js';
import { fetchServerBlockedLeadHistory } from '../lib/leadRepository.js';
import { currentMonthValue, monthDateRange } from '../lib/monthRange.js';
import './InboxPanel.css';

const DUPLICATE_TEXT = {
  title: '페이지 중복 차단',
  subtitle: '이 페이지 접수 기준으로 관리합니다.',
  ip: 'IP',
  ipDesc: '같은 IP 제한',
  cookie: '쿠키',
  cookieDesc: '같은 브라우저 제한',
  count: '횟수',
  countDesc: '몇 번째 접수부터 막을지 선택',
  window: '기간',
  windowDesc: '중복 확인 기간',
  contact: '연락처/이메일',
  contactDesc: '같은 연락처 또는 이메일 처리',
  history: '차단 내역',
  historyDesc: '월별 조회',
  refresh: '조회',
  loading: '조회 중',
  empty: '차단 내역 없음',
  noDate: '날짜 없음',
  noPage: '페이지 미확인',
  noIdentity: '식별 정보 없음',
  total: '전체',
  recent: '건 중 최근',
  shown: '건 표시',
  on: '켜짐',
  off: '꺼짐',
};

const DUPLICATE_LIMIT_COUNTS = [
  ['1', '1회부터 차단'],
  ['2', '2회부터 차단'],
  ['3', '3회부터 차단'],
  ['5', '5회부터 차단'],
];

const DUPLICATE_LIMIT_WINDOWS = [
  ['1d', '1일'],
  ['3d', '3일'],
  ['7d', '7일'],
  ['30d', '1개월'],
];

const DUPLICATE_CONTACT_OPTIONS = [
  ['mark', '접수 후 표시'],
  ['block', '차단'],
];

const CONNECTION_COPY = {
  internal: {
    title: '접수 저장',
    summary: '모든 접수는 먼저 서버 접수함에 저장됩니다.',
    status: '정상 저장',
  },
  email: {
    title: '이메일 알림',
    summary: '새 접수를 이메일로 보냅니다.',
  },
  webhook: {
    title: 'Webhook 전송',
    summary: '외부 도구로 접수 데이터를 보냅니다.',
  },
  automation: {
    title: 'Make / Zapier',
    summary: 'Make, Zapier, n8n Webhook으로 같은 payload를 보냅니다.',
  },
  sheets: {
    title: 'Google Sheets',
    summary: 'Apps Script Web App URL로 접수 payload를 보내 시트 저장을 준비합니다.',
  },
};

const BLOCK_REASON_LABELS = {
  phone_duplicate: '연락처 중복',
  email_duplicate: '이메일 중복',
  client_duplicate_limit: '쿠키 중복',
  ip_duplicate_limit: 'IP 중복',
  ip_rate_limit_1m: 'IP 과다 제출',
  rate_limited: '제출 제한',
};

function normalizeDuplicateSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const count = String(source.formDuplicateLimitCount || '3');
  const windowKey = String(source.formDuplicateLimitWindow || '1d');
  const phoneEmailMode = String(source.phoneEmailMode || 'mark');
  return {
    rejectIpDuplicate: !!source.rejectIpDuplicate,
    rejectCookieDuplicate: source.rejectCookieDuplicate !== false,
    formDuplicateLimitCount: ['1', '2', '3', '5'].includes(count) ? count : '3',
    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(windowKey) ? windowKey : '1d',
    phoneEmailMode: ['mark', 'block'].includes(phoneEmailMode) ? phoneEmailMode : 'mark',
  };
}

function blockedReason(reason) {
  const key = String(reason || '').trim();
  return BLOCK_REASON_LABELS[key] || key || '차단';
}

function blockedIdentity(item = {}) {
  return String(item.contactSummary || item.maskedContact || item.clientId || item.userAgentHash || DUPLICATE_TEXT.noIdentity).trim();
}

function leadTime(lead = {}) {
  const time = new Date(lead.createdAt || lead.savedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function leadInDateRange(lead = {}, range = {}) {
  const time = leadTime(lead);
  if (!time) return false;
  if (range.dateFrom && time < new Date(`${range.dateFrom}T00:00:00`).getTime()) return false;
  if (range.dateTo && time > new Date(`${range.dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

function ConnectionStatus({ state }) {
  return <em className={`connection-status ${state.tone}`}>{state.text}</em>;
}

function MiniToggle({ active, children, onClick }) {
  return <button type="button" className={`mini-toggle ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

function ConnectionToggleRow({ label, checked, onChange }) {
  return (
    <div className="connection-inline-control">
      <span>{label}</span>
      <button type="button" className={`inline-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>{checked ? 'ON' : 'OFF'}</button>
    </div>
  );
}

function ConnectionInputRow({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="connection-inline-control">
      <span>{label}</span>
      <input value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DuplicatePolicySwitch({ label, description, checked, onChange }) {
  return (
    <button type="button" className={`inbox-policy-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span><b>{label}</b><small>{description}</small></span>
      <b>{checked ? DUPLICATE_TEXT.on : DUPLICATE_TEXT.off}</b>
    </button>
  );
}

function DuplicatePolicySelect({ label, description, value, options, onChange }) {
  return (
    <label className="inbox-policy-select">
      <span><b>{label}</b><small>{description}</small></span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function compactConnectionState(state = {}) {
  if (state.tone === 'ok' || state.tone === 'ready') return '정상';
  if (state.tone === 'warn') return '확인 필요';
  return '꺼짐';
}

function connectionSummary(type, integrations) {
  if (type === 'internal') return CONNECTION_COPY.internal.status;
  if (type === 'email') {
    if (!integrations.email.enabled) return '꺼짐';
    return integrations.email.to || '받을 이메일 필요';
  }
  if (type === 'webhook') {
    if (!integrations.webhook.enabled) return '꺼짐';
    return integrations.webhook.url || '전송 URL 필요';
  }
  return '';
}

function IntakeDuplicatePolicyPanel({ page, authUser, updatePage }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthValue());
  const [history, setHistory] = useState({ records: [], total: 0, loading: false, error: '' });
  const settings = normalizeDuplicateSettings(page.leadDuplicateSettings || page.duplicateCollectionSettings || {});
  const localHistory = Array.isArray(page.leadDuplicateSettings?.blockedHistory)
    ? page.leadDuplicateSettings.blockedHistory
    : Array.isArray(page.blockedLeadHistory)
      ? page.blockedLeadHistory
      : [];
  const visibleHistory = history.records.length || history.error || history.loading ? history.records : localHistory;
  const windowLabel = DUPLICATE_LIMIT_WINDOWS.find(([value]) => value === settings.formDuplicateLimitWindow)?.[1] || '1일';
  const policyChips = [
    settings.rejectIpDuplicate ? 'IP 차단' : 'IP 허용',
    settings.rejectCookieDuplicate ? '쿠키 차단' : '쿠키 허용',
    settings.phoneEmailMode === 'block' ? '연락처/이메일 차단' : '연락처/이메일 표시',
    `${windowLabel} 기준`,
  ];

  const save = (patch) => {
    updatePage?.({ leadDuplicateSettings: normalizeDuplicateSettings({ ...settings, ...patch }) });
  };

  const loadHistory = async () => {
    setHistory((current) => ({ ...current, loading: true, error: '' }));
    try {
      const result = await fetchServerBlockedLeadHistory(page, authUser, { month, limit: 50 });
      setHistory({
        records: result?.records || [],
        total: Number(result?.total || 0),
        loading: false,
        error: '',
      });
    } catch (error) {
      setHistory({
        records: localHistory,
        total: localHistory.length,
        loading: false,
        error: String(error?.message || error || ''),
      });
    }
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open, month]);

  return (
    <section className={`card inbox-policy-card ${open ? 'open' : ''}`}>
      <button type="button" className="inbox-policy-head" onClick={() => setOpen(!open)}>
        <span>
          <strong>{DUPLICATE_TEXT.title}</strong>
          <small>{DUPLICATE_TEXT.subtitle}</small>
          <i className="inbox-policy-chip-row">
            {policyChips.map((chip) => <b key={chip}>{chip}</b>)}
          </i>
        </span>
        <em>{open ? '접기' : '열기'}</em>
      </button>
      {open && (
        <div className="inbox-policy-body">
          <div className="inbox-policy-grid">
            <DuplicatePolicySwitch label={DUPLICATE_TEXT.ip} description={DUPLICATE_TEXT.ipDesc} checked={settings.rejectIpDuplicate} onChange={(value) => save({ rejectIpDuplicate: value })} />
            <DuplicatePolicySwitch label={DUPLICATE_TEXT.cookie} description={DUPLICATE_TEXT.cookieDesc} checked={settings.rejectCookieDuplicate} onChange={(value) => save({ rejectCookieDuplicate: value })} />
            <DuplicatePolicySelect label={DUPLICATE_TEXT.count} description={DUPLICATE_TEXT.countDesc} value={settings.formDuplicateLimitCount} options={DUPLICATE_LIMIT_COUNTS} onChange={(value) => save({ formDuplicateLimitCount: value })} />
            <DuplicatePolicySelect label={DUPLICATE_TEXT.window} description={DUPLICATE_TEXT.windowDesc} value={settings.formDuplicateLimitWindow} options={DUPLICATE_LIMIT_WINDOWS} onChange={(value) => save({ formDuplicateLimitWindow: value })} />
            <DuplicatePolicySelect label={DUPLICATE_TEXT.contact} description={DUPLICATE_TEXT.contactDesc} value={settings.phoneEmailMode} options={DUPLICATE_CONTACT_OPTIONS} onChange={(value) => save({ phoneEmailMode: value })} />
          </div>

          <div className="inbox-policy-history">
            <div className="inbox-policy-history-head">
              <span>
                <strong>{DUPLICATE_TEXT.history}</strong>
                <small>{DUPLICATE_TEXT.historyDesc}</small>
              </span>
              <div>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
                <button type="button" disabled={history.loading} onClick={loadHistory}>{history.loading ? DUPLICATE_TEXT.loading : DUPLICATE_TEXT.refresh}</button>
              </div>
            </div>
            {history.error && <span className="inbox-policy-error">{history.error}</span>}
            {history.loading ? (
              <span className="inbox-policy-empty">{DUPLICATE_TEXT.loading}</span>
            ) : !visibleHistory.length ? (
              <span className="inbox-policy-empty">{DUPLICATE_TEXT.empty}</span>
            ) : (
              <ul>
                {visibleHistory.slice(0, 8).map((item, index) => (
                  <li key={item.id || index}>
                    <b>{String(item.date || item.createdAt || '').slice(0, 10) || DUPLICATE_TEXT.noDate}</b>
                    <em>{String(item.pageSlug || item.page || item.form || item.formId || DUPLICATE_TEXT.noPage)}</em>
                    <small>{blockedReason(item.reason || item.duplicateReason)} · {blockedIdentity(item)}</small>
                  </li>
                ))}
              </ul>
            )}
            {history.total > visibleHistory.length && (
              <small className="inbox-policy-more">{DUPLICATE_TEXT.total} {history.total}{DUPLICATE_TEXT.recent} {visibleHistory.length}{DUPLICATE_TEXT.shown}</small>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function standardConnectionStateText(state = {}) {
  if (state.tone === 'ok' || state.tone === 'ready') return '준비됨';
  if (state.tone === 'warn') return '설정 필요';
  if (state.tone === 'fail') return '실패';
  return '꺼짐';
}

function ConnectionItem({ title, state, opened, onOpen, children, summary, description, actions }) {
  return (
    <div className={`connection-item connect-v4 ${opened ? 'open' : ''}`}>
      <div className="connection-row">
        <button type="button" className="connection-row-main" onClick={onOpen}>
          <strong>{title}</strong>
          {description && <span>{description}</span>}
          {summary && <small>{summary}</small>}
        </button>
        <ConnectionStatus state={{ ...state, text: standardConnectionStateText(state) }} />
        <button type="button" className="connection-row-edit" onClick={onOpen}>{opened ? '닫기' : '설정'}</button>
      </div>
      {opened && (
        <div className="connection-detail-box compact">
          {children}
          {actions && <div className="connection-save-actions">{actions}</div>}
        </div>
      )}
    </div>
  );
}

function connectionTitle(type) {
  const map = {
    internal: '접수 저장',
    google: 'Google',
    email: '이메일 알림',
    webhook: 'Webhook',
    automation: '자동화',
    calendar: '캘린더',
  };
  return map[type] || '연동';
}

function InboxConnectionsPanel({ page, updateIntegrations, onSavePage }) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [savingType, setSavingType] = useState('');
  const counts = useMemo(() => connectionCounts(integrations), [integrations]);

  const setIntegration = (section, patch) => updateIntegrations(section, patch);
  const saveSection = async (type) => {
    setSavingType(type);
    setResult(null);
    try {
      await onSavePage?.();
      setResult({ ok: true, message: `${connectionTitle(type)} 설정을 서버에 저장했습니다.` });
    } catch (error) {
      setResult({ ok: false, message: `저장에 실패했습니다. ${String(error?.message || error)}` });
    } finally {
      setSavingType('');
    }
  };

  return (
    <section className={`card inbox-connect-card easy-mode v4 ${open ? 'open' : ''}`}>
      <button className="inbox-connect-head" type="button" onClick={() => setOpen(!open)}>
        <div>
          <h2>알림 / 연동</h2>
        </div>
        <div className="connect-head-right">
          <span>{counts.ok}개 켜짐</span>
          {counts.warn > 0 && <i>{counts.warn}개 확인</i>}
          <b>{open ? '접기' : '열기'}</b>
        </div>
      </button>

      {open && (
        <div className="inbox-connect-body">
          {result && <div className={`connection-result ${result.ok ? 'ok' : 'error'}`}><strong>{result.ok ? '저장됨' : '저장 실패'}</strong><span>{result.message}</span></div>}

          <ConnectionItem title={CONNECTION_COPY.internal.title} description={CONNECTION_COPY.internal.summary} state={connectionState('internal', integrations)} opened={false} onOpen={() => {}} summary={connectionSummary('internal', integrations)}>
            <div className="connection-form-box compact-line"><div className="connection-inline-control readonly"><span>상태</span><b>정상 저장</b></div></div>
          </ConnectionItem>

          <ConnectionItem title={CONNECTION_COPY.email.title} description={CONNECTION_COPY.email.summary} state={connectionState('email', integrations)} opened={true} onOpen={() => {}} summary={connectionSummary('email', integrations)} actions={<button type="button" className="save-connection-btn" disabled={savingType === 'email'} onClick={() => saveSection('email')}>{savingType === 'email' ? '저장 중' : '저장'}</button>}>
            <div className="connection-form-box compact-line">
              <ConnectionToggleRow label="이메일 알림" checked={!!integrations.email.enabled} onChange={(value) => setIntegration('email', { enabled: value })} />
              {integrations.email.enabled && <>
                <ConnectionInputRow label="받을 이메일" value={integrations.email.to || ''} onChange={(value) => setIntegration('email', { to: value })} placeholder="example@email.com" />
                <div className="connection-inline-control"><span>알림 대상</span><div className="inline-chip-row"><MiniToggle active={integrations.email.consult !== false} onClick={() => setIntegration('email', { consult: !(integrations.email.consult !== false) })}>상담</MiniToggle><MiniToggle active={integrations.email.reservation !== false} onClick={() => setIntegration('email', { reservation: !(integrations.email.reservation !== false) })}>예약</MiniToggle></div></div>
              </>}
            </div>
          </ConnectionItem>

          <ConnectionItem title={CONNECTION_COPY.webhook.title} description={CONNECTION_COPY.webhook.summary} state={connectionState('webhook', integrations)} opened={true} onOpen={() => {}} summary={connectionSummary('webhook', integrations)} actions={<button type="button" className="save-connection-btn" disabled={savingType === 'webhook'} onClick={() => saveSection('webhook')}>{savingType === 'webhook' ? '저장 중' : '저장'}</button>}>
            <div className="connection-form-box compact-line">
              <ConnectionToggleRow label="Webhook 사용" checked={!!integrations.webhook.enabled} onChange={(value) => setIntegration('webhook', { enabled: value })} />
              {integrations.webhook.enabled && <ConnectionInputRow label="전송 URL" value={integrations.webhook.url || ''} onChange={(value) => setIntegration('webhook', { url: value })} placeholder="https://..." />}
            </div>
          </ConnectionItem>
        </div>
      )}
    </section>
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

function LeadInfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="lead-info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function fmtDateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR');
}

function deliveryTone(status = 'none') {
  if (status === 'success') return 'success';
  if (status === 'failed' || status === 'partial') return 'failed';
  if (status === 'pending') return 'pending';
  return 'none';
}

function deliveryLogStatusText(status = '') {
  return status === 'success' ? '성공' : status === 'pending' ? '대기' : '실패';
}

function deliveryProviderText(log = {}) {
  const provider = String(log.provider || '').toLowerCase();
  if (provider === 'ses' || provider === 'email') return '메일';
  if (provider === 'webhook') return '웹훅';
  return log.target || '전송';
}

function deliveryTimeText(value = '') {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 16) : date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function DebouncedMemoInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  useEffect(() => {
    if ((value || '') === draft) return undefined;
    const timer = window.setTimeout(() => onCommit(draft), 650);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit, value]);

  return (
    <input
      placeholder="내부 메모를 입력하세요"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if ((value || '') !== draft) onCommit(draft);
      }}
    />
  );
}

function LeadConflictNotice({ conflict, onReload, onRetry, onDismiss }) {
  if (!conflict) return null;
  const actionText = conflict.action === 'delete' ? '삭제' : '저장';
  const latestTime = conflict.latest?.updatedAt || conflict.latest?.savedAt || conflict.latest?.createdAt || '';
  return (
    <section className="lead-conflict-notice" role="status">
      <div>
        <strong>접수 데이터 {actionText} 충돌</strong>
        <span>{conflict.message || '다른 화면에서 먼저 수정된 접수 데이터입니다.'}</span>
        {latestTime && <small>서버 기준 시간: {fmtDate(latestTime)}</small>}
      </div>
      <div className="lead-conflict-actions">
        <button type="button" onClick={onReload}>최신 목록 불러오기</button>
        <button type="button" onClick={onRetry}>{conflict.action === 'delete' ? '삭제 다시 시도' : '변경 다시 시도'}</button>
        <button type="button" className="ghost" onClick={onDismiss}>닫기</button>
      </div>
    </section>
  );
}

export default function InboxPanel({ leads, page, authUser = null, updatePage, syncing = false, totalLeads = 0, hasMoreLeads = false, loadMoreLeads, onFiltersChange, updateIntegrations, onSavePage, updateLead, deleteLead, retryLeadDelivery, retryFailedDeliveries, exportLeadsCsv, leadConflict, onReloadLeadConflict, onRetryLeadConflict, onDismissLeadConflict }) {
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(currentMonthValue());
  const [openId, setOpenId] = useState('');
  const updateLeadSafe = updateLead || (() => {});
  const selectedMonthRange = useMemo(() => monthDateRange(month), [month]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onFiltersChange?.({ kind: filter, status: statusFilter, deliveryStatus: deliveryFilter, q: query.trim(), month });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [deliveryFilter, filter, month, onFiltersChange, query, statusFilter]);

  const { normalized, consultCount, reservationCount, newCount, failedDeliveryCount, filtered } = useMemo(() => {
    const items = (leads || []).map(normalizeLeadItem);
    const q = query.trim().toLowerCase();
    let consult = 0;
    let reservation = 0;
    let fresh = 0;
    let failed = 0;
    const visible = [];

    items.forEach((lead) => {
      const kind = leadKind(lead);
      if (!leadInDateRange(lead, selectedMonthRange)) return;
      if (kind === 'reservation') reservation += 1;
      else consult += 1;
      if (lead.status === '신규') fresh += 1;
      if (['failed', 'partial'].includes(lead.delivery?.status)) failed += 1;
      if (filter !== 'all' && kind !== filter) return;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return;
      if (deliveryFilter === 'needs-attention' && !['failed', 'partial'].includes(lead.delivery?.status)) return;
      if (deliveryFilter !== 'all' && deliveryFilter !== 'needs-attention' && lead.delivery?.status !== deliveryFilter) return;
      if (q && !leadSearchText(lead).includes(q)) return;
      visible.push(lead);
    });

    return { normalized: items, consultCount: consult, reservationCount: reservation, newCount: fresh, failedDeliveryCount: failed, filtered: visible };
  }, [deliveryFilter, filter, leads, query, selectedMonthRange, statusFilter]);
  const loadedCount = normalized.length;
  const serverTotal = Number(totalLeads || loadedCount);
  const loadMoreLabel = hasMoreLeads
    ? `더보기 ${loadedCount}/${serverTotal || loadedCount}`
    : '더보기';
  const listSummary = serverTotal > loadedCount
    ? `${filtered.length}건 표시 중 · 서버 ${serverTotal}건 중 ${loadedCount}건 로드`
    : `${filtered.length}건 표시 중`;

  return (
    <div className="simple-panel inbox-panel inbox-v2 inbox-v3">
      <IntakeDuplicatePolicyPanel page={page} authUser={authUser} updatePage={updatePage} />

      <section className="inbox-summary-v2 inbox-summary-v3">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          <span>전체</span><strong>{normalized.length}건</strong><small>신규 {newCount}건</small>
        </button>
        <button className={filter === 'consult' ? 'active' : ''} onClick={() => setFilter('consult')}>
          <span>상담</span><strong>{consultCount}건</strong><small>상담 접수</small>
        </button>
        <button className={filter === 'reservation' ? 'active' : ''} onClick={() => setFilter('reservation')}>
          <span>예약</span><strong>{reservationCount}건</strong><small>방문 예약</small>
        </button>
      </section>

      <LeadConflictNotice conflict={leadConflict} onReload={onReloadLeadConflict} onRetry={onRetryLeadConflict} onDismiss={onDismissLeadConflict} />

      <section className="card inbox-toolbar-card inbox-toolbar-v3">
        <div className="inbox-toolbar">
          <div className="inbox-search">
            <span>검색</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 연락처, 메모, 답변 검색" />
          </div>
          <div className="inbox-status-filter">
            <span>월</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
          </div>
          <div className="inbox-status-filter">
            <span>상태</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">전체</option>
              {LEAD_STATUS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="inbox-status-filter">
            <span>전송</span>
            <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}>
              <option value="all">전체</option>
              <option value="needs-attention">확인 필요</option>
              <option value="success">성공</option>
              <option value="partial">일부 실패</option>
              <option value="failed">실패</option>
              <option value="pending">진행 중</option>
              <option value="none">없음</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card inbox-list-card inbox-list-v3">
        <div className="section-title inbox-list-title">
          <div>
            <h2>접수 목록</h2>
            <p>{listSummary}{failedDeliveryCount ? ` · 전송 확인 ${failedDeliveryCount}건` : ''}</p>
          </div>
          <div className="inbox-list-actions">
            {failedDeliveryCount > 0 && <button type="button" className="danger" onClick={retryFailedDeliveries}>실패 재전송</button>}
            {hasMoreLeads && <button type="button" disabled={syncing} onClick={loadMoreLeads}>{syncing ? '불러오는 중' : loadMoreLabel}</button>}
            <button type="button" disabled={!filtered.length} title={`${month} 한 달 단위 CSV로 내보냅니다.`} onClick={() => exportLeadsCsv?.(filtered, { month, kind: filter, status: statusFilter, deliveryStatus: deliveryFilter, q: query.trim() })}>월 CSV</button>
            <button type="button" onClick={() => { setFilter('all'); setStatusFilter('all'); setDeliveryFilter('all'); setQuery(''); }}>초기화</button>
          </div>
        </div>

        {syncing && <div className="inbox-sync-note">서버 접수 데이터를 불러오는 중입니다.</div>}
        {hasMoreLeads && !syncing && <div className="inbox-sync-note">첫 화면은 10건만 표시합니다. 더보기를 누르면 다음 10건을 불러옵니다.</div>}

        {!filtered.length ? <div className="empty">조건에 맞는 접수 데이터가 없습니다.</div> : (
          <div className="lead-list-v3">
            {filtered.map((lead, index) => {
              const opened = openId === lead.id;
              const answers = Array.isArray(lead.answers) ? lead.answers : [];
              const history = Array.isArray(lead.history) ? lead.history.slice().reverse() : [];
              return (
                <article className={`lead-card-v3 ${opened ? 'open' : ''}`} key={lead.id}>
                  <div className="lead-row-v3">
                    <button className="lead-row-main-v3" type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>
                      <span className={`lead-kind-pill ${leadKind(lead)}`}>#{index + 1} {leadKindLabel(lead)}</span>
                      <strong>{lead.name || '이름 없음'}</strong>
                      <em>{leadPrimaryContact(lead)}</em>
                    </button>

                    <div className="lead-row-meta-v3">
                      {lead.duplicate && <b className="lead-status hold">중복</b>}
                      {lead.duplicateReason?.includes('spam_suspected') && <b className="lead-status hold">스팸 의심</b>}
                      <b className={`lead-status ${statusClass(lead.status)}`}>{lead.status}</b>
                      <small>{fmtDateOnly(lead.createdAt)}</small>
                      <button type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>{opened ? '닫기' : '상세'}</button>
                    </div>
                  </div>

                  {opened && (
                    <div className="lead-detail-v3">
                      <section className="lead-detail-section">
                        <h3>고객 정보</h3>
                        <div className="lead-info-grid">
                          <LeadInfoRow label="접수 유형" value={lead.type} />
                          <LeadInfoRow label="접수 시간" value={fmtDate(lead.createdAt)} />
                          <LeadInfoRow label="이름" value={lead.name || '-'} />
                          <LeadInfoRow label="연락처" value={lead.phone || '-'} />
                          <LeadInfoRow label="이메일" value={lead.email} />
                          <LeadInfoRow label="주소" value={lead.address} />
                        </div>
                      </section>

                      {lead.message && (
                        <section className="lead-detail-section">
                          <h3>문의 내용</h3>
                          <div className="lead-message-box">{lead.message}</div>
                        </section>
                      )}

                      {!!answers.length && (
                        <section className="lead-detail-section">
                          <h3>질문 답변</h3>
                          <div className="lead-answer-list-v3">
                            {answers.map((answer) => (
                              <div key={answer.id || answer.label}>
                                <span>{answer.label}</span>
                                <b>{Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-')}</b>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      <section className={`lead-detail-section lead-delivery-section ${deliveryTone(lead.delivery?.status)}`}>
                        <div className="lead-delivery-head">
                          <h3>전송 상태</h3>
                          <b>{deliveryStatusLabel(lead.delivery?.status)}</b>
                        </div>
                        <div className="lead-delivery-summary">
                          <strong>{lead.delivery?.summary || '외부 전송 없음'}</strong>
                          <span>{lead.delivery?.logs?.length ? `${lead.delivery.logs.length}개 전송 로그` : '연결된 메일 또는 웹훅이 없습니다.'}</span>
                          {['failed', 'partial'].includes(lead.delivery?.status) && (
                            <button type="button" onClick={() => retryLeadDelivery?.(lead)}>재전송</button>
                          )}
                        </div>
                        {!!(lead.delivery?.logs || []).length && (
                          <div className="lead-delivery-log-list">
                            {(lead.delivery.logs || []).map((log, idx) => (
                              <div className={`lead-delivery-log ${deliveryTone(log.status)}`} key={`${log.target}-${idx}`}>
                                <span>{deliveryProviderText(log)}</span>
                                <b>{deliveryLogStatusText(log.status)}</b>
                                <em>{log.message || '-'}</em>
                                {log.at && <small>{deliveryTimeText(log.at)}</small>}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="lead-detail-section lead-manage-section">
                        <h3>관리</h3>
                        <StatusPills value={lead.status} onChange={(status) => updateLeadSafe(lead.id, { status })} />
                        <label className="lead-memo-v3">
                          <span>메모</span>
                          <DebouncedMemoInput value={lead.memo || ''} onCommit={(memo) => updateLeadSafe(lead.id, { memo })} />
                        </label>
                        <button className="delete delete-v3" onClick={() => deleteLead?.(lead.id)}>삭제</button>
                      </section>

                      {!!history.length && (
                        <section className="lead-detail-section">
                          <h3>변경 이력</h3>
                          <div className="lead-history-list">
                            {history.slice(0, 8).map((item, idx) => (
                              <div key={item.id || `${item.at}-${idx}`}>
                                <span>{item.type === 'status' ? '상태' : '메모'}</span>
                                <b>{item.type === 'status' ? `${item.from || '-'} → ${item.to || '-'}` : '메모 수정'}</b>
                                <small>{fmtDate(item.at)}</small>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <InboxConnectionsPanel page={page} updateIntegrations={updateIntegrations} onSavePage={onSavePage} />
    </div>
  );
}
