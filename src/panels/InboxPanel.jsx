import { useEffect, useMemo, useState } from 'react';
import { normalizeIntegrations } from '../lib/pageModel.js';
import { connectionCounts, connectionState, runConnectionTest } from '../lib/leadIntegrations.js';
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
import { trafficSourceLabel } from '../lib/trafficAttribution.js';
import './InboxPanel.css';

const DUPLICATE_COUNTS = [
  ['1', '1회부터 차단'],
  ['2', '2회부터 차단'],
  ['3', '3회부터 차단'],
  ['5', '5회부터 차단'],
];

const DUPLICATE_WINDOWS = [
  ['1d', '1일'],
  ['3d', '3일'],
  ['7d', '7일'],
  ['30d', '30일'],
];

const CONTACT_OPTIONS = [
  ['mark', '표시만'],
  ['block', '차단'],
];

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

function fmtDateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '').slice(0, 10) : date.toLocaleDateString('ko-KR');
}

function MiniToggle({ active, children, onClick }) {
  return <button type="button" className={`mini-toggle ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
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

function DuplicatePolicySelect({ label, value, options, onChange }) {
  return (
    <label className="inbox-policy-select compact">
      <span><b>{label}</b></span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function DuplicatePolicySwitch({ label, checked, onChange }) {
  return (
    <button type="button" className={`inbox-policy-switch compact ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span><b>{label}</b></span>
      <b>{checked ? '켜짐' : '꺼짐'}</b>
    </button>
  );
}

function blockedReason(reason) {
  return {
    phone_duplicate: '연락처 중복',
    email_duplicate: '이메일 중복',
    client_duplicate_limit: '쿠키 중복',
    ip_duplicate_limit: 'IP 중복',
    ip_rate_limit_1m: 'IP 과다 제출',
    rate_limited: '제출 제한',
  }[String(reason || '').trim()] || String(reason || '차단');
}

function IntakeDuplicatePolicyPanel({ page, authUser, updatePage }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthValue());
  const [history, setHistory] = useState({ records: [], total: 0, loading: false, error: '' });
  const settings = normalizeDuplicateSettings(page.leadDuplicateSettings || page.duplicateCollectionSettings || {});
  const localHistory = Array.isArray(page.leadDuplicateSettings?.blockedHistory) ? page.leadDuplicateSettings.blockedHistory : [];
  const visibleHistory = history.records.length || history.error || history.loading ? history.records : localHistory;

  const save = (patch) => {
    updatePage?.({ leadDuplicateSettings: normalizeDuplicateSettings({ ...settings, ...patch }) });
  };

  const loadHistory = async () => {
    setHistory((current) => ({ ...current, loading: true, error: '' }));
    try {
      const result = await fetchServerBlockedLeadHistory(page, authUser, { month, limit: 50 });
      setHistory({ records: result?.records || [], total: Number(result?.total || 0), loading: false, error: '' });
    } catch (error) {
      setHistory({ records: localHistory, total: localHistory.length, loading: false, error: String(error?.message || error || '') });
    }
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open, month]);

  return (
    <section className={`card inbox-policy-card ${open ? 'open' : ''}`}>
      <button type="button" className="inbox-policy-head" onClick={() => setOpen(!open)}>
        <span>
          <strong>중복 차단</strong>
          <small>IP, 쿠키, 연락처 기준을 정합니다.</small>
        </span>
        <em>{open ? '접기' : '열기'}</em>
      </button>
      {open && (
        <div className="inbox-policy-body">
          <div className="inbox-policy-grid">
            <DuplicatePolicySwitch label="IP 중복" checked={settings.rejectIpDuplicate} onChange={(value) => save({ rejectIpDuplicate: value })} />
            <DuplicatePolicySwitch label="쿠키 중복" checked={settings.rejectCookieDuplicate} onChange={(value) => save({ rejectCookieDuplicate: value })} />
            <DuplicatePolicySelect label="제한 횟수" value={settings.formDuplicateLimitCount} options={DUPLICATE_COUNTS} onChange={(value) => save({ formDuplicateLimitCount: value })} />
            <DuplicatePolicySelect label="제한 기간" value={settings.formDuplicateLimitWindow} options={DUPLICATE_WINDOWS} onChange={(value) => save({ formDuplicateLimitWindow: value })} />
            <DuplicatePolicySelect label="연락처/메일" value={settings.phoneEmailMode} options={CONTACT_OPTIONS} onChange={(value) => save({ phoneEmailMode: value })} />
          </div>

          <div className="inbox-policy-history">
            <div className="inbox-policy-history-head">
              <strong>차단 내역</strong>
              <div>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
                <button type="button" disabled={history.loading} onClick={loadHistory}>{history.loading ? '조회 중' : '조회'}</button>
              </div>
            </div>
            {history.error && <span className="inbox-policy-error">{history.error}</span>}
            {history.loading ? (
              <span className="inbox-policy-empty">조회 중</span>
            ) : !visibleHistory.length ? (
              <span className="inbox-policy-empty">차단 내역 없음</span>
            ) : (
              <ul>
                {visibleHistory.slice(0, 8).map((item, index) => (
                  <li key={item.id || index}>
                    <b>{String(item.date || item.createdAt || '').slice(0, 10) || '-'}</b>
                    <em>{String(item.pageSlug || item.page || item.form || item.formId || '-')}</em>
                    <small>{blockedReason(item.reason || item.duplicateReason)}</small>
                  </li>
                ))}
              </ul>
            )}
            {history.total > visibleHistory.length && <small className="inbox-policy-more">전체 {history.total}건 중 최근 {visibleHistory.length}건</small>}
          </div>
        </div>
      )}
    </section>
  );
}

function InlineSwitch({ checked, onChange }) {
  return (
    <button type="button" className={`inline-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      {checked ? 'ON' : 'OFF'}
    </button>
  );
}

const GOOGLE_SHEETS_APPS_SCRIPT = `const SHEET_NAME = '접수함';
const BASE_HEADERS = [
  '접수일시',
  '이름',
  '연락처',
  '이메일',
  '메시지',
  '페이지명',
  '페이지 URL',
  'UTM Source',
  'UTM Medium',
  'UTM Campaign',
  '유입 URL'
];
const JSON_HEADER = '추가 입력값 JSON';

function samplePayload() {
  return {
    createdAt: new Date().toISOString(),
    sheetName: SHEET_NAME,
    lead: {
      name: '테스트',
      phone: '010-0000-0000',
      email: 'test@example.com',
      message: '수동 실행 테스트',
      fields: {
        '관심 타입': '84A',
        '예산대': '5억~7억'
      }
    },
    page: { title: '페이지로 테스트', url: '' },
    source: { utmSource: 'test', utmMedium: '', utmCampaign: '', sourceUrl: '' }
  };
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return samplePayload();
  return JSON.parse(e.postData.contents || '{}');
}

function safeFieldMap(data) {
  const fields = data && data.lead && data.lead.fields;
  return fields && typeof fields === 'object' && !Array.isArray(fields) ? fields : {};
}

function appendLead(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = data.sheetName || SHEET_NAME;
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const fields = safeFieldMap(data);
  const headers = ensureHeaders(sheet);
  const source = data.source || data.attribution || {};
  const baseValues = {
    '접수일시': data.lead?.createdAt || data.createdAt || new Date().toISOString(),
    '이름': data.lead?.name || '',
    '연락처': data.lead?.phone || '',
    '이메일': data.lead?.email || '',
    '메시지': data.lead?.message || '',
    '페이지명': data.page?.title || '',
    '페이지 URL': data.page?.url || '',
    'UTM Source': source.utmSource || '',
    'UTM Medium': source.utmMedium || '',
    'UTM Campaign': source.utmCampaign || '',
    '유입 URL': source.sourceUrl || source.referrer || '',
    [JSON_HEADER]: JSON.stringify(fields)
  };
  const row = headers.map((header) => fields[header] ?? baseValues[header] ?? '');
  sheet.appendRow(row);
}

function ensureHeaders(sheet) {
  const required = BASE_HEADERS.concat([JSON_HEADER]);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(required);
    return required;
  }
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((value) => String(value || '').trim());
  const headers = current.filter(Boolean);
  const missing = required.filter((header) => headers.indexOf(header) === -1);
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    return headers.concat(missing);
  }
  return headers;
}

function doPost(e) {
  appendLead(parsePayload(e));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Pagero Google Sheets webhook is ready.');
}`;

function InboxConnectionsPanel({ page, updateIntegrations, onSavePage }) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const [draftIntegrations, setDraftIntegrations] = useState(integrations);
  const [draftDirty, setDraftDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [result, setResult] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const counts = useMemo(() => connectionCounts(draftIntegrations), [draftIntegrations]);
  const emailState = connectionState('email', draftIntegrations);
  const sheetsState = connectionState('sheets', draftIntegrations);
  const webhookState = connectionState('webhook', draftIntegrations);

  useEffect(() => {
    if (!draftDirty) setDraftIntegrations(integrations);
  }, [page.slug, page.updatedAt, draftDirty]);

  const draftPatch = (section, value) => {
    const currentSection = draftIntegrations?.[section] || {};
    const nextSection = { ...currentSection, ...value };
    const nextIntegrations = normalizeIntegrations({ ...draftIntegrations, [section]: nextSection });
    setDraftIntegrations(nextIntegrations);
    setDraftDirty(true);
    return nextIntegrations;
  };

  const patch = (section, value) => {
    const nextIntegrations = draftPatch(section, value);
    updateIntegrations?.(section, nextIntegrations[section]);
  };

  const sheetPatch = (value) => {
    const nextIntegrations = draftPatch('sheets', value);
    updateIntegrations?.('sheets', nextIntegrations.sheets);
    return nextIntegrations;
  };

  const saveSheetsDraft = async () => {
    const currentSheets = draftIntegrations.sheets || {};
    const currentUrl = currentSheets.webhookUrl || currentSheets.url || '';
    const hasWebhook = !!String(currentUrl || '').trim();
    const nextIntegrations = draftPatch('sheets', {
      ...currentSheets,
      enabled: hasWebhook || !!currentSheets.enabled,
      webhookUrl: currentUrl,
      url: currentUrl,
      sheetName: currentSheets.sheetName || '접수함',
      status: hasWebhook ? (currentSheets.status === 'error' ? 'connected' : currentSheets.status || 'connected') : 'disconnected',
      lastError: '',
    });
    updateIntegrations?.('sheets', nextIntegrations.sheets);
    setSaving(true);
    setResult('');
    try {
      await onSavePage?.({ ...page, integrations: nextIntegrations });
      setDraftDirty(false);
      setResult('Google Sheets 설정 저장 완료');
    } catch (error) {
      setResult(`Google Sheets 저장 실패: ${String(error?.message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  const resultOk = result && !/(실패|오류|error|failed|not defined|권한|응답 실패|URL 확인|입력해주세요)/i.test(result);

  const copySheetsScript = async () => {
    setResult('');
    try {
      await navigator.clipboard.writeText(GOOGLE_SHEETS_APPS_SCRIPT);
      setCopiedScript(true);
      setResult('Google Sheets 샘플 코드 복사 완료');
      window.setTimeout(() => setCopiedScript(false), 1800);
    } catch (error) {
      setResult('복사 실패');
    }
  };

  const testSheets = async () => {
    setTesting('sheets');
    setResult('');
    const currentSheets = draftIntegrations.sheets || {};
    const currentUrl = currentSheets.webhookUrl || currentSheets.url || '';
    const currentSheetName = currentSheets.sheetName || '접수함';
    sheetPatch({
      webhookUrl: currentUrl,
      url: currentUrl,
      sheetName: currentSheetName,
      enabled: true,
      lastError: '',
    });
    try {
      const testIntegrations = normalizeIntegrations({
        ...draftIntegrations,
        sheets: {
          ...currentSheets,
          enabled: true,
          webhookUrl: currentUrl,
          url: currentUrl,
          sheetName: currentSheetName,
        },
      });
      const response = await runConnectionTest('sheets', { ...page, integrations: testIntegrations });
      const ok = !!response?.ok;
      sheetPatch({
        webhookUrl: currentUrl,
        url: currentUrl,
        sheetName: currentSheetName,
        enabled: true,
        status: ok ? 'connected' : 'error',
        lastSyncAt: ok ? new Date().toISOString() : currentSheets.lastSyncAt,
        lastError: ok ? '' : (response?.message || 'Google Sheets 연결 테스트 실패'),
      });
      setResult(response?.message || (ok ? 'Google Sheets 테스트 완료' : 'Google Sheets 테스트 실패'));
    } catch (error) {
      const message = `Google Sheets 테스트 실패: ${String(error?.message || error || '접수 저장은 유지됩니다.')}`;
      sheetPatch({
        webhookUrl: currentUrl,
        url: currentUrl,
        sheetName: currentSheetName,
        enabled: true,
        status: 'error',
        lastError: message,
      });
      setResult(message);
    } finally {
      setTesting('');
    }
  };

  const save = async () => {
    setSaving(true);
    setResult('');
    try {
      Object.entries(draftIntegrations).forEach(([section, value]) => {
        updateIntegrations?.(section, value);
      });
      await onSavePage?.({ ...page, integrations: draftIntegrations });
      setDraftDirty(false);
      setResult('저장됨');
    } catch (error) {
      setResult(`저장 실패: ${String(error?.message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`card inbox-connect-card easy-mode v4 ${open ? 'open' : ''}`}>
      <button className="inbox-connect-head" type="button" onClick={() => setOpen(!open)}>
        <div><h2>연동</h2></div>
        <div className="connect-head-right">
          <span>{counts.ok}개 연결</span>
          {counts.warn > 0 && <i>{counts.warn}개 확인 필요</i>}
          <b>{open ? '접기' : '열기'}</b>
        </div>
      </button>
      {open && (
        <div className="inbox-connect-body compact">
          {result && <div className={`connection-result ${resultOk ? 'ok' : 'error'}`}><span>{result}</span></div>}
          <div className="connection-item connect-v4 open">
            <div className="connection-row">
              <div className="connection-row-main"><strong>이메일 알림</strong><small>{emailState.text}</small></div>
              <InlineSwitch checked={!!draftIntegrations.email.enabled} onChange={(enabled) => patch('email', { enabled })} />
            </div>
            {draftIntegrations.email.enabled && (
              <div className="connection-detail-box compact">
                <label className="connection-inline-control">
                  <span>받을 이메일</span>
                  <input value={draftIntegrations.email.to || ''} placeholder="example@email.com" onChange={(event) => patch('email', { to: event.target.value })} />
                </label>
                <div className="connection-inline-control">
                  <span>알림 대상</span>
                  <div className="inline-chip-row">
                    <MiniToggle active={draftIntegrations.email.consult !== false} onClick={() => patch('email', { consult: !(draftIntegrations.email.consult !== false) })}>상담</MiniToggle>
                    <MiniToggle active={draftIntegrations.email.reservation !== false} onClick={() => patch('email', { reservation: !(draftIntegrations.email.reservation !== false) })}>예약</MiniToggle>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="connection-item connect-v4 open">
            <div className="connection-row">
              <div className="connection-row-main"><strong>Google Sheets</strong><small>{sheetsState.text} · 접수 자동 저장</small></div>
              <InlineSwitch checked={!!draftIntegrations.sheets.enabled} onChange={(enabled) => sheetPatch({ enabled, status: enabled ? draftIntegrations.sheets.status || 'disconnected' : 'disconnected', lastError: enabled ? '' : draftIntegrations.sheets.lastError })} />
            </div>
            {draftIntegrations.sheets.enabled && (
              <div className="connection-detail-box compact">
                <label className="connection-inline-control">
                  <span>Webhook URL</span>
                  <input value={draftIntegrations.sheets.webhookUrl || draftIntegrations.sheets.url || ''} placeholder="Google Apps Script Web App URL" onChange={(event) => sheetPatch({ webhookUrl: event.target.value, url: event.target.value, status: 'disconnected', lastError: '' })} />
                </label>
                <label className="connection-inline-control">
                  <span>시트명</span>
                  <input value={draftIntegrations.sheets.sheetName || ''} placeholder="접수함" onChange={(event) => sheetPatch({ sheetName: event.target.value })} />
                </label>
                <p className="connection-help-text">전송 실패 시에도 접수 데이터는 페이지로 접수함에 먼저 보관됩니다.</p>
                {draftIntegrations.sheets.lastError && <div className="connection-result error"><span>{draftIntegrations.sheets.lastError}</span></div>}
                <div className="connection-inline-actions">
                  <button type="button" className="test-connection-btn" onClick={copySheetsScript}>{copiedScript ? '복사됨' : '샘플 코드 복사'}</button>
                  <button type="button" className="test-connection-btn" disabled={testing === 'sheets'} onClick={testSheets}>{testing === 'sheets' ? '테스트 중' : '연결 테스트'}</button>
                  <button type="button" className="save-connection-btn" onClick={saveSheetsDraft}>연동 저장</button>
                  <button type="button" className="test-connection-btn" onClick={() => patch('sheets', { enabled: false, status: 'disconnected', webhookUrl: '', url: '', lastError: '' })}>연결 해제</button>
                </div>
              </div>
            )}
          </div>
          <div className="connection-item connect-v4 open">
            <div className="connection-row">
              <div className="connection-row-main"><strong>Webhook</strong><small>{webhookState.text}</small></div>
              <InlineSwitch checked={!!draftIntegrations.webhook.enabled} onChange={(enabled) => patch('webhook', { enabled })} />
            </div>
            {draftIntegrations.webhook.enabled && (
              <div className="connection-detail-box compact">
                <label className="connection-inline-control">
                  <span>전송 URL</span>
                  <input value={draftIntegrations.webhook.url || ''} placeholder="https://..." onChange={(event) => patch('webhook', { url: event.target.value })} />
                </label>
              </div>
            )}
          </div>
          <button type="button" className="save-connection-btn" disabled={saving} onClick={save}>{saving ? '저장 중' : '저장'}</button>
        </div>
      )}
    </section>
  );
}

function LeadSource({ lead }) {
  const label = trafficSourceLabel(lead);
  const url = lead.sourceUrl || lead.pageUrl || '';
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
  const selectedMonthRange = useMemo(() => monthDateRange(month), [month]);
  const updateLeadSafe = updateLead || (() => {});

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
  const listSummary = serverTotal > loadedCount
    ? `${filtered.length}건 표시 중 · 서버 ${serverTotal}건 중 ${loadedCount}건 로드`
    : `${filtered.length}건 표시 중`;

  return (
    <div className="simple-panel inbox-panel inbox-v2 inbox-v3">
      <IntakeDuplicatePolicyPanel page={page} authUser={authUser} updatePage={updatePage} />

      <section className="inbox-summary-v2 inbox-summary-v3">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          <span>{'전체'}</span><strong>{normalized.length}{'건'}</strong><small>{'신규'} {newCount}{'건'}</small>
        </button>
        <button className={filter === 'consult' ? 'active' : ''} onClick={() => setFilter('consult')}>
          <span>{'상담'}</span><strong>{consultCount}{'건'}</strong><small>{'상담'} {'접수'}</small>
        </button>
        <button className={filter === 'reservation' ? 'active' : ''} onClick={() => setFilter('reservation')}>
          <span>{'예약'}</span><strong>{reservationCount}{'건'}</strong><small>{'방문'} {'예약'}</small>
        </button>
      </section>

      <LeadConflictNotice conflict={leadConflict} onReload={onReloadLeadConflict} onRetry={onRetryLeadConflict} onDismiss={onDismissLeadConflict} />

      <section className="card inbox-toolbar-card inbox-toolbar-v3">
        <div className="inbox-toolbar">
          <label className="inbox-search">
            <span>{'검색'}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'이름, 연락처, 메모 검색'} />
          </label>
          <label className="inbox-status-filter">
            <span>{'월'}</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
          </label>
          <label className="inbox-status-filter">
            <span>{'상태'}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">{'전체'}</option>
              {LEAD_STATUS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card inbox-list-card inbox-list-v3">
        <div className="section-title inbox-list-title">
          <div>
            <h2>{'접수'} {'목록'}</h2>
            <p>{listSummary}</p>
          </div>
          <div className="inbox-list-actions">
            {hasMoreLeads && <button type="button" disabled={syncing} onClick={loadMoreLeads}>{syncing ? '불러오는 중' : `더보기 ${loadedCount}/${serverTotal || loadedCount}`}</button>}
            <button type="button" disabled={!filtered.length} title={`${month} 한 달 단위 CSV로 내보냅니다.`} onClick={() => exportLeadsCsv?.(filtered, { month, kind: filter, status: statusFilter, deliveryStatus: 'all', q: query.trim() })}>월 CSV</button>
            <button type="button" onClick={() => { setFilter('all'); setStatusFilter('all'); setQuery(''); }}>{'초기화'}</button>
          </div>
        </div>

        {syncing && <div className="inbox-sync-note">{'서버'} {'접수'} {'데이터를'} {'불러오는'} {'중입니다.'}</div>}
        {hasMoreLeads && !syncing && <div className="inbox-sync-note">일부 접수만 표시 중입니다. 더보기로 이어서 불러올 수 있습니다.</div>}

        {!filtered.length ? <div className="empty">{'조건에'} {'맞는'} {'접수'} {'데이터가'} {'없습니다.'}</div> : (
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
                      <LeadSource lead={lead} />
                      {lead.duplicate && <b className="lead-status hold">{'중복'}</b>}
                      {lead.duplicateReason?.includes('spam_suspected') && <b className="lead-status hold">{'스팸'} {'의심'}</b>}
                      <b className={`lead-status ${statusClass(lead.status)}`}>{lead.status}</b>
                      <small>{fmtDateOnly(lead.createdAt)}</small>
                      <button type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>{opened ? '닫기' : '상세'}</button>
                    </div>
                  </div>

                  {opened && (
                    <div className="lead-detail-v3">
                      <section className="lead-detail-section">
                        <h3>{'고객'} {'정보'}</h3>
                        <div className="lead-info-grid">
                          <LeadInfoRow label={'접수'} value={lead.type} />
                          <LeadInfoRow label={'접수일시'} value={fmtDate(lead.createdAt)} />
                          <LeadInfoRow label={'이름'} value={lead.name || '-'} />
                          <LeadInfoRow label={'연락처'} value={lead.phone || '-'} />
                          <LeadInfoRow label={'이메일'} value={lead.email} />
                          <LeadInfoRow label={'주소'} value={lead.address} />
                        </div>
                      </section>

                      <section className="lead-detail-section">
                        <h3>{'유입'} {'정보'}</h3>
                        <div className="lead-info-grid">
                          <LeadInfoRow label={'유입'} value={trafficSourceLabel(lead)} />
                          <LeadInfoRow label={'접수 URL'} value={lead.sourceUrl || lead.pageUrl || '-'} />
                          <LeadInfoRow label={'이전 URL'} value={lead.referrer || '-'} />
                          <LeadInfoRow label={'캠페인'} value={lead.utmCampaign || '-'} />
                        </div>
                      </section>

                      {lead.message && (
                        <section className="lead-detail-section">
                          <h3>{'문의'} {'내용'}</h3>
                          <div className="lead-message-box">{lead.message}</div>
                        </section>
                      )}

                      {!!answers.length && (
                        <section className="lead-detail-section">
                          <h3>{'질문'} {'답변'}</h3>
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

                      <section className="lead-detail-section lead-manage-section">
                        <h3>{'관리'}</h3>
                        <StatusPills value={lead.status} onChange={(status) => updateLeadSafe(lead.id, { status })} />
                        <label className="lead-memo-v3">
                          <span>{'메모'}</span>
                          <DebouncedMemoInput value={lead.memo || ''} onCommit={(memo) => updateLeadSafe(lead.id, { memo })} />
                        </label>
                        <button className="delete delete-v3" onClick={() => deleteLead?.(lead.id)}>{'삭제'}</button>
                      </section>

                      {!!history.length && (
                        <section className="lead-detail-section">
                          <h3>{'변경'} {'이력'}</h3>
                          <div className="lead-history-list">
                            {history.slice(0, 8).map((item, idx) => (
                              <div key={item.id || `${item.at}-${idx}`}>
                                <span>{item.type === 'status' ? '상태' : '메모'}</span>
                                <b>{item.type === 'status' ? `${item.from || '-'} -> ${item.to || '-'}` : '메모 수정'}</b>
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
