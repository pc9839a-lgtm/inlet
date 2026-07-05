import { useEffect, useState } from 'react';
import { fetchServerBlockedLeadHistory } from '../../lib/leadRepository.js';
import { currentMonthValue } from '../../lib/monthRange.js';

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
    <button type="button" className={'inbox-policy-switch compact ' + (checked ? 'on' : '')} onClick={() => onChange(!checked)}>
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
  return [hitCount && limit ? hitCount + '/' + limit : '', window, contact].filter(Boolean).join(' · ');
}

export default function IntakeDuplicatePolicyPanel({ page, authUser, updatePage }) {
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
    <section className={'card inbox-policy-card ' + (open ? 'open' : '')}>
      <button type="button" className="inbox-policy-head" onClick={() => setOpen(!open)}>
        <span>
          <strong>중복 차단</strong>
          <small>반복 접수 처리 기준을 정합니다.</small>
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
                    <small>{blockedReason(item.reason || item.duplicateReason)}{blockedSignalSummary(item) ? ' · ' + blockedSignalSummary(item) : ''}</small>
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

