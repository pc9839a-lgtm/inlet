import { useEffect, useMemo, useState } from 'react';
import { normalizeIntegrations } from '../lib/pageModel.js';
import { connectionCounts, connectionState, runConnectionTest } from '../lib/leadIntegrations.js';
import { apiFetch, postJson, projectAuthHeaders } from '../lib/apiClient.js';
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
import { projectContext } from '../lib/projectContext.js';
import { trafficSourceLabel } from '../lib/trafficAttribution.js';
import './InboxPanel.css';

// QA label contract: 연동 전체 저장
const DUPLICATE_COUNTS = [
  ['1', '같은 데이터 1개 이상'],
  ['2', '같은 데이터 2개 이상'],
  ['3', '같은 데이터 3개 이상'],
  ['5', '같은 데이터 5개 이상'],
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

function firstText(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

function leadSourceUrl(lead = {}) {
  return firstText(
    lead.sourceUrl,
    lead.source?.sourceUrl,
    lead.source?.url,
    lead.source?.pageUrl,
    lead.attribution?.sourceUrl,
    lead.values?.sourceUrl,
    lead.pageUrl,
  );
}

function leadReferrer(lead = {}) {
  return firstText(
    lead.referrer,
    lead.source?.referrer,
    lead.attribution?.referrer,
    lead.values?.referrer,
  );
}

function leadUtmText(lead = {}) {
  const source = firstText(lead.utmSource, lead.utm_source, lead.source?.utmSource, lead.source?.utm_source, lead.attribution?.utmSource, lead.values?.utmSource, lead.values?.utm_source);
  const medium = firstText(lead.utmMedium, lead.utm_medium, lead.source?.utmMedium, lead.source?.utm_medium, lead.attribution?.utmMedium, lead.values?.utmMedium, lead.values?.utm_medium);
  const campaign = firstText(lead.utmCampaign, lead.utm_campaign, lead.source?.utmCampaign, lead.source?.utm_campaign, lead.attribution?.utmCampaign, lead.values?.utmCampaign, lead.values?.utm_campaign);
  return [
    source ? `source=${source}` : '',
    medium ? `medium=${medium}` : '',
    campaign ? `campaign=${campaign}` : '',
  ].filter(Boolean).join(' / ');
}

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function isDuplicateLeadAnswer(item = {}, lead = {}) {
  const label = normalizedText(item.label || item.name);
  const value = normalizedText(item.value);
  const duplicateLabels = ['name', '이름', '성함', '연락처', '전화', '휴대폰', '핸드폰', 'phone', 'email', '이메일', '문의내용', '상담내용', 'message'];
  if (duplicateLabels.some((key) => label.includes(normalizedText(key)))) return true;
  const duplicateValues = [
    lead.name,
    leadPrimaryContact(lead),
    lead.email,
    lead.message,
  ].map(normalizedText).filter(Boolean);
  return value && duplicateValues.includes(value);
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

function blockedSignalSummary(item = {}) {
  const hits = item.fieldSummary?.hits || item.policySnapshot?.metrics || {};
  const reason = String(item.reason || item.duplicateReason || '');
  const hitCount = reason === 'ip_duplicate_limit' || reason === 'ip_rate_limit_1m'
    ? Number(hits.ipMinuteHits || hits.ipHits || 0)
    : reason === 'client_duplicate_limit'
      ? Number(hits.clientHits || 0)
      : Number(hits.phoneHits || hits.emailHits || 0);
  const limit = Number(hits.limit || item.policySnapshot?.formDuplicateLimitCount || 0);
  const window = hits.window || item.policySnapshot?.formDuplicateLimitWindow || '';
  const contact = item.contactSummary || '';
  return [hitCount && limit ? `${hitCount}/${limit}` : '', window, contact].filter(Boolean).join(' · ');
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
          <small>IP, 쿠키, 연락처 기준으로 반복 접수를 정리합니다.</small>
        </span>
        <em>{open ? '접기' : '열기'}</em>
      </button>
      {open && (
        <div className="inbox-policy-body">
          <div className="inbox-policy-grid">
            <DuplicatePolicySwitch label="IP 중복 차단" checked={settings.rejectIpDuplicate} onChange={(value) => save({ rejectIpDuplicate: value })} />
            <DuplicatePolicySwitch label="쿠키 중복 차단" checked={settings.rejectCookieDuplicate} onChange={(value) => save({ rejectCookieDuplicate: value })} />
            <DuplicatePolicySelect label="중복 제한 개수" value={settings.formDuplicateLimitCount} options={DUPLICATE_COUNTS} onChange={(value) => save({ formDuplicateLimitCount: value })} />
            <DuplicatePolicySelect label="중복 제한 기간" value={settings.formDuplicateLimitWindow} options={DUPLICATE_WINDOWS} onChange={(value) => save({ formDuplicateLimitWindow: value })} />
            <DuplicatePolicySelect label="연락처/이메일 중복" value={settings.phoneEmailMode} options={CONTACT_OPTIONS} onChange={(value) => save({ phoneEmailMode: value })} />
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
                    <small>{blockedReason(item.reason || item.duplicateReason)}{blockedSignalSummary(item) ? ` · ${blockedSignalSummary(item)}` : ''}</small>
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
const BASE_HEADERS = ['접수일시','이름','연락처','이메일','메시지','페이지명','페이지 URL','UTM Source','UTM Medium','UTM Campaign','유입 URL'];
const JSON_HEADER = '추가 입력값 JSON';
const TEST_PAYLOAD = {
  createdAt: new Date().toISOString(),
  sheetName: SHEET_NAME,
  lead: { name: '테스트', phone: '010-0000-0000', email: 'test@example.com', message: '수동 실행 테스트', fields: { '관심 타입': '84A', '예산대': '5억-7억' } },
  page: { title: '페이지로 테스트', url: '' },
  source: { utmSource: 'test', utmMedium: '', utmCampaign: '', sourceUrl: '' }
};

function doPost(e) {
  const data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : TEST_PAYLOAD;
  const lead = data.lead || {};
  const page = data.page || {};
  const source = data.source || data.attribution || {};
  const fields = lead.fields && typeof lead.fields === 'object' && !Array.isArray(lead.fields) ? lead.fields : {};
  const sheet = getSheet(data.sheetName || SHEET_NAME);
  const headers = ensureHeaders(sheet, Object.keys(fields));
  const values = {
    '접수일시': lead.createdAt || data.createdAt || new Date().toISOString(),
    '이름': lead.name || '',
    '연락처': lead.phone || '',
    '이메일': lead.email || '',
    '메시지': lead.message || '',
    '페이지명': page.title || '',
    '페이지 URL': page.url || '',
    'UTM Source': source.utmSource || '',
    'UTM Medium': source.utmMedium || '',
    'UTM Campaign': source.utmCampaign || '',
    '유입 URL': source.sourceUrl || source.referrer || '',
    [JSON_HEADER]: JSON.stringify(fields)
  };
  sheet.appendRow(headers.map((header) => fields[header] !== undefined ? fields[header] : (values[header] || '')));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders(sheet, fieldHeaders) {
  const customHeaders = (fieldHeaders || []).map((header) => String(header || '').trim()).filter(Boolean);
  const required = BASE_HEADERS.concat(customHeaders, [JSON_HEADER]);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(required);
    return required;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map((value) => String(value || '').trim()).filter(Boolean);
  const missing = required.filter((header) => headers.indexOf(header) === -1);
  if (missing.length) sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  return headers.concat(missing);
}

function doGet() {
  return ContentService.createTextOutput('Pagero Google Sheets webhook is ready.');
}`;

function isFreeEmailLocked(page = {}, authUser = null) {
  const plan = String(page?.plan || page?.billingPlan || page?.billing?.plan || authUser?.plan || authUser?.billingPlan || 'free').trim().toLowerCase();
  const paidPlans = ['paid', 'pro', 'premium', 'business', 'agency', 'enterprise'];
  return !paidPlans.includes(plan);
}

function lockedAccountEmail(authUser = null, page = {}, integrations = null) {
  const sourceIntegrations = integrations || normalizeIntegrations(page.integrations || {});
  return String(
    authUser?.email
    || page?.ownership?.ownerEmail
    || page?.ownerEmail
    || page?.clientEmail
    || sourceIntegrations?.email?.to
    || ''
  ).trim().toLowerCase();
}

function enforceFreeEmailIntegration(integrations = {}, page = {}, authUser = null) {
  const normalized = normalizeIntegrations(integrations || {});
  if (!isFreeEmailLocked(page, authUser)) return normalized;
  const accountEmail = lockedAccountEmail(authUser, page, normalized);
  return normalizeIntegrations({
    ...normalized,
    email: {
      ...(normalized.email || {}),
      to: accountEmail || '',
      lockedToAccount: true,
    },
  });
}

function InboxConnectionsPanel({ page, authUser = null, updateIntegrations, onSavePage }) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const emailLocked = isFreeEmailLocked(page, authUser);
  const accountEmail = lockedAccountEmail(authUser, page, integrations);
  const [draftIntegrations, setDraftIntegrations] = useState(() => enforceFreeEmailIntegration(integrations, page, authUser));
  const [draftDirty, setDraftDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [result, setResult] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const counts = useMemo(() => connectionCounts(draftIntegrations), [draftIntegrations]);
  const emailState = connectionState('email', draftIntegrations);
  const sheetsState = connectionState('sheets', draftIntegrations);
  const webhookState = connectionState('webhook', draftIntegrations);

  useEffect(() => {
    if (!draftDirty) setDraftIntegrations(enforceFreeEmailIntegration(integrations, page, authUser));
  }, [page.slug, page.updatedAt, authUser?.email, draftDirty]);

  useEffect(() => {
    if (!emailLocked) return;
    setDraftIntegrations((current) => {
      const next = enforceFreeEmailIntegration(current, page, authUser);
      if ((current.email?.to || '') === (next.email?.to || '') && current.email?.lockedToAccount === true) return current;
      return next;
    });
  }, [emailLocked, accountEmail, page.slug]);

  const draftPatch = (section, value) => {
    const currentSection = draftIntegrations?.[section] || {};
    const nextSection = { ...currentSection, ...value };
    const nextIntegrations = enforceFreeEmailIntegration({ ...draftIntegrations, [section]: nextSection }, page, authUser);
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

  const googleSheetsProject = () => {
    const context = projectContext(page, authUser);
    return {
      ...context,
      id: context.projectId,
      title: page.title || '',
    };
  };

  const switchSheetsMode = (mode) => {
    const nextMode = mode === 'webhook' ? 'webhook' : 'oauth';
    sheetPatch({
      enabled: true,
      mode: nextMode,
      status: nextMode === 'oauth'
        ? (draftIntegrations.sheets.connectedEmail && draftIntegrations.sheets.spreadsheetId ? 'connected' : 'disconnected')
        : (draftIntegrations.sheets.webhookUrl || draftIntegrations.sheets.url ? draftIntegrations.sheets.status || 'connected' : 'disconnected'),
      lastError: '',
    });
  };

  const connectGoogleSheetsOAuth = async () => {
    const project = googleSheetsProject();
    if (!project.projectId) {
      setResult('페이지를 먼저 저장한 뒤 Google Sheets를 연결해주세요.');
      return;
    }
    setTesting('sheets-oauth');
    setResult('');
    try {
      const response = await postJson('/api/integrations/google/sheets/oauth-url', {
        projectId: project.projectId,
        ownerId: project.ownerId,
        slug: project.slug,
        project,
      }, {
        headers: projectAuthHeaders(project),
      });
      if (!response?.authUrl) throw new Error(response?.message || 'Google 연결 URL을 만들지 못했습니다.');
      sheetPatch({ enabled: true, mode: 'oauth', status: 'disconnected', lastError: '' });
      window.open(response.authUrl, '_blank', 'noopener,noreferrer');
      setResult('Google 연결 창을 열었습니다. 완료 후 상태 확인을 눌러주세요.');
    } catch (error) {
      setResult(`Google 연결 실패: ${String(error?.message || error)}`);
    } finally {
      setTesting('');
    }
  };

  const refreshGoogleSheetsOAuthStatus = async () => {
    const project = googleSheetsProject();
    if (!project.projectId) {
      setResult('페이지를 먼저 저장한 뒤 상태를 확인해주세요.');
      return;
    }
    setTesting('sheets-status');
    setResult('');
    try {
      const query = new URLSearchParams({
        projectId: project.projectId,
        slug: project.slug || '',
      });
      const response = await apiFetch(`/api/integrations/google/sheets/status?${query.toString()}`, {
        headers: projectAuthHeaders(project),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `상태 확인 실패: ${response.status}`);
      const nextIntegrations = sheetPatch({
        enabled: true,
        mode: 'oauth',
        status: data.connected ? 'connected' : 'disconnected',
        connectedEmail: data.connectedEmail || '',
        spreadsheetId: data.spreadsheetId || '',
        spreadsheetUrl: data.spreadsheetUrl || '',
        sheetName: data.sheetName || draftIntegrations.sheets.sheetName || '접수함',
        lastError: data.hasError ? (draftIntegrations.sheets.lastError || 'Google Sheets 연결 확인이 필요합니다.') : '',
      });
      if (data.connected) {
        try {
          await onSavePage?.({ ...page, integrations: nextIntegrations });
          setDraftDirty(false);
        } catch {
          setDraftDirty(true);
        }
      }
      setResult(data.connected ? 'Google Sheets 연결 완료' : 'Google 연결이 아직 완료되지 않았습니다.');
    } catch (error) {
      setResult(`Google 상태 확인 실패: ${String(error?.message || error)}`);
    } finally {
      setTesting('');
    }
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
    } catch {
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
    const nextIntegrations = enforceFreeEmailIntegration(draftIntegrations, page, authUser);
    try {
      Object.entries(nextIntegrations).forEach(([section, value]) => {
        updateIntegrations?.(section, value);
      });
      await onSavePage?.({ ...page, integrations: nextIntegrations });
      setDraftIntegrations(nextIntegrations);
      setDraftDirty(false);
      setResult('저장 완료');
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
              <InlineSwitch checked={!!draftIntegrations.email.enabled} onChange={(enabled) => patch('email', { enabled, ...(emailLocked ? { to: accountEmail, lockedToAccount: true } : {}) })} />
            </div>
            {draftIntegrations.email.enabled && (
              <div className="connection-detail-box compact">
                <label className="connection-inline-control email-recipient-control">
                  <span>받을 이메일</span>
                  {emailLocked ? (
                    <strong className="locked-email-value" aria-label="계정 이메일로 고정됨">{accountEmail || '계정 이메일 없음'}</strong>
                  ) : (
                    <input
                      value={draftIntegrations.email.to || ''}
                      placeholder="example@email.com"
                      onChange={(event) => patch('email', { to: event.target.value })}
                    />
                  )}
                </label>
                {emailLocked && <p className="connection-help-text">무료 사용자는 계정 이메일로만 알림을 받습니다.</p>}
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
              <div className="connection-row-main"><strong>Google Sheets</strong><small>{sheetsState.text} · 입력폼 자동 컬럼</small></div>
              <InlineSwitch checked={!!draftIntegrations.sheets.enabled} onChange={(enabled) => sheetPatch({ enabled, status: enabled ? draftIntegrations.sheets.status || 'disconnected' : 'disconnected', lastError: enabled ? '' : draftIntegrations.sheets.lastError })} />
            </div>
            {draftIntegrations.sheets.enabled && (
              <div className="connection-detail-box compact">
                <div className="connection-inline-control">
                  <span>연결 방식</span>
                  <div className="inline-chip-row">
                    <MiniToggle active={(draftIntegrations.sheets.mode || 'oauth') === 'oauth'} onClick={() => switchSheetsMode('oauth')}>Google 연결</MiniToggle>
                    <MiniToggle active={draftIntegrations.sheets.mode === 'webhook'} onClick={() => switchSheetsMode('webhook')}>직접 URL</MiniToggle>
                  </div>
                </div>
                {(draftIntegrations.sheets.mode || 'oauth') === 'oauth' ? (
                  <>
                    <div className="connection-inline-control">
                      <span>연결 계정</span>
                      <strong className="locked-email-value">{draftIntegrations.sheets.connectedEmail || '연결 필요'}</strong>
                    </div>
                    {draftIntegrations.sheets.spreadsheetUrl && (
                      <a className="test-connection-btn" href={draftIntegrations.sheets.spreadsheetUrl} target="_blank" rel="noreferrer">시트 열기</a>
                    )}
                    <div className="connection-inline-actions">
                      <button type="button" className="save-connection-btn" disabled={testing === 'sheets-oauth'} onClick={connectGoogleSheetsOAuth}>{testing === 'sheets-oauth' ? '연결 중' : 'Google로 연결'}</button>
                      <button type="button" className="test-connection-btn" disabled={testing === 'sheets-status'} onClick={refreshGoogleSheetsOAuthStatus}>{testing === 'sheets-status' ? '확인 중' : '상태 확인'}</button>
                      <button type="button" className="test-connection-btn" onClick={() => sheetPatch({ enabled: false, mode: 'oauth', status: 'disconnected', connectedEmail: '', spreadsheetId: '', spreadsheetUrl: '', lastError: '' })}>연결 해제</button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="connection-inline-control">
                      <span>Webhook URL</span>
                      <input value={draftIntegrations.sheets.webhookUrl || draftIntegrations.sheets.url || ''} placeholder="Google Apps Script Web App URL" onChange={(event) => sheetPatch({ webhookUrl: event.target.value, url: event.target.value, status: 'disconnected', lastError: '' })} />
                    </label>
                    <label className="connection-inline-control">
                      <span>시트명</span>
                      <input value={draftIntegrations.sheets.sheetName || ''} placeholder="접수함" onChange={(event) => sheetPatch({ sheetName: event.target.value })} />
                    </label>
                    <div className="connection-inline-actions">
                      <button type="button" className="test-connection-btn" onClick={copySheetsScript}>{copiedScript ? '복사됨' : '샘플 코드 복사'}</button>
                      <button type="button" className="test-connection-btn" disabled={testing === 'sheets'} onClick={testSheets}>{testing === 'sheets' ? '테스트 중' : '연결 테스트'}</button>
                      <button type="button" className="save-connection-btn" disabled={saving} onClick={saveSheetsDraft}>연동 저장</button>
                      <button type="button" className="test-connection-btn" onClick={() => patch('sheets', { enabled: false, status: 'disconnected', webhookUrl: '', url: '', lastError: '' })}>연결 해제</button>
                    </div>
                  </>
                )}
                {draftIntegrations.sheets.lastError && <div className="connection-result error"><span>{draftIntegrations.sheets.lastError}</span></div>}
              </div>
            )}
          </div>

          <button type="button" className="connection-advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
            <span>고급 연동</span>
            <b>{draftIntegrations.webhook.enabled ? webhookState.text : '선택 사항'}</b>
          </button>
          {advancedOpen && (
            <div className="connection-item connect-v4 open advanced">
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
          )}
          <button type="button" className="save-connection-btn" disabled={saving} onClick={save}>{saving ? '저장 중' : '연동 전체 저장'}</button>
        </div>
      )}
    </section>
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
    ? `${filtered.length}건 표시 · 전체 ${serverTotal}건 중 ${loadedCount}건 로드`
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
    } catch {
      window.prompt('접수 내용을 복사하세요', text);
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

      <LeadConflictNotice
        conflict={leadConflict}
        onReload={reloadLeads}
        onRetry={retryLeadSave}
        onDismiss={onDismissLeadConflict}
      />

      <section className="card inbox-toolbar-card inbox-toolbar-v3">
        <div className="section-title">
          <span>접수 검색</span>
          <b>{displaySummary}</b>
        </div>
        <div className="inbox-toolbar">
          <label>
            <span>검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, 연락처, 문의 내용"
            />
          </label>
          <label>
            <span>월</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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
          <button type="button" className="btn secondary" onClick={reloadLeads} disabled={syncing}>
            새로고침
          </button>
        </div>
      </section>

      <section className="card inbox-list-card inbox-list-v3">
        <div className="section-title inbox-list-title">
          <span>접수 목록</span>
          <div className="inbox-list-actions">
            {hasMoreLeads ? (
              <button type="button" className="btn secondary" onClick={loadMore} disabled={syncing}>
                50개 더보기
              </button>
            ) : null}
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
              const answers = Array.isArray(lead.answers)
                ? lead.answers.filter((item) => !isDuplicateLeadAnswer(item, lead))
                : [];
              return (
                <article className={`lead-card-v3 lead-card-service ${opened ? 'open' : ''}`} key={lead.id}>
                  <div className="lead-row-service">
                    <span>#{index + 1}</span>
                    <b>{leadKindLabel(lead)}</b>
                    <strong>{lead.name || '이름 없음'}</strong>
                    <em>{leadPrimaryContact(lead) || '-'}</em>
                    <small>{fmtDateOnly(lead.createdAt)}</small>
                    <button type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>
                      {opened ? '닫기' : '상세'}
                    </button>
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
                              <LeadInfoRow
                                key={`${lead.id}-answer-${answerIndex}`}
                                label={item.label || item.name || `질문 ${answerIndex + 1}`}
                                value={item.value}
                              />
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

                      <div className="lead-detail-actions-service">
                        <button type="button" className="btn secondary" onClick={() => copyLead(lead)}>복사</button>
                        <button type="button" className="btn primary" onClick={() => setOpenId('')}>닫기</button>
                      </div>
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
