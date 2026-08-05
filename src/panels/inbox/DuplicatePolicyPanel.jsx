import { useEffect, useMemo, useRef, useState } from 'react';
import { isServerLeadMode } from '../../config/runtimeConfig.js';
import { fetchServerBlockedLeadHistory } from '../../lib/leadRepository.js';
import { currentMonthValue } from '../../lib/monthRange.js';

const DUPLICATE_COUNTS = [
  ['1', '1회부터'],
  ['2', '2회부터'],
  ['3', '3회부터'],
  ['5', '5회부터'],
];

const DUPLICATE_WINDOWS = [
  ['1d', '24시간'],
  ['3d', '3일'],
  ['7d', '7일'],
  ['30d', '30일'],
];

const CONTACT_OPTIONS = [
  ['mark', '중복 표시만'],
  ['block', '제출 차단'],
];

function normalizeDuplicateSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const count = String(source.formDuplicateLimitCount || '3');
  const windowKey = String(source.formDuplicateLimitWindow || '1d');
  const phoneEmailMode = String(source.phoneEmailMode || 'mark');
  const cookiePolicyExplicit = source.cookieDuplicatePolicyExplicit === true || Number(source.duplicatePolicyVersion || 0) >= 2;
  return {
    rejectIpDuplicate: !!source.rejectIpDuplicate,
    rejectCookieDuplicate: cookiePolicyExplicit && source.rejectCookieDuplicate === true,
    cookieDuplicatePolicyExplicit: cookiePolicyExplicit,
    duplicatePolicyVersion: cookiePolicyExplicit ? 2 : 1,
    formDuplicateLimitCount: ['1', '2', '3', '5'].includes(count) ? count : '3',
    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(windowKey) ? windowKey : '1d',
    phoneEmailMode: ['mark', 'block'].includes(phoneEmailMode) ? phoneEmailMode : 'mark',
  };
}

function DuplicatePolicySelect({ label, description, value, options, onChange, badge = '' }) {
  return (
    <label className="inbox-policy-select compact policy-control-card">
      <span>
        <b>{label}</b>
        <small>{description}</small>
        {badge ? <em>{badge}</em> : null}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function DuplicatePolicySwitch({ label, description, checked, onChange, badge = '' }) {
  return (
    <button type="button" className={'inbox-policy-switch compact policy-control-card ' + (checked ? 'on' : '')} onClick={() => onChange(!checked)}>
      <span>
        <b>{label}</b>
        <small>{description}</small>
        {badge ? <em>{badge}</em> : null}
      </span>
      <b className="policy-switch-state">{checked ? '사용' : '미사용'}</b>
    </button>
  );
}

function blockedReason(reason) {
  return {
    phone_duplicate: '연락처 중복',
    email_duplicate: '이메일 중복',
    client_duplicate_limit: '브라우저 중복',
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
  const [open, setOpen] = useState(true);
  const [month, setMonth] = useState(currentMonthValue());
  const [visibleCount, setVisibleCount] = useState(8);
  const [history, setHistory] = useState({ records: [], total: 0, nextCursor: null, hasMore: false, loading: false, loaded: false, error: '' });
  const historyRequestRef = useRef(0);
  const settings = normalizeDuplicateSettings(page.leadDuplicateSettings || page.duplicateCollectionSettings || {});
  const serverHistory = isServerLeadMode();
  const localHistory = !serverHistory && Array.isArray(page.leadDuplicateSettings?.blockedHistory)
    ? page.leadDuplicateSettings.blockedHistory
    : [];
  const visibleHistory = history.loaded ? history.records : localHistory;
  const displayedHistory = visibleHistory.slice(0, visibleCount);
  const hiddenLoadedHistory = visibleHistory.length > visibleCount;
  const historyKey = page.id || page.slug || page.url || '';
  const activePolicyCount = useMemo(() => [
    settings.rejectIpDuplicate,
    settings.rejectCookieDuplicate,
    settings.phoneEmailMode === 'block',
  ].filter(Boolean).length, [settings.rejectIpDuplicate, settings.rejectCookieDuplicate, settings.phoneEmailMode]);

  const save = (patch) => {
    updatePage?.({ leadDuplicateSettings: normalizeDuplicateSettings({ ...settings, ...patch }) });
  };

  const loadHistory = async ({ append = false } = {}) => {
    const requestId = ++historyRequestRef.current;
    const cursor = append ? history.nextCursor : 0;
    if (append && cursor == null) return;

    setHistory((current) => ({ ...current, loading: true, error: '' }));
    try {
      const result = await fetchServerBlockedLeadHistory(page, authUser, { month, limit: 50, cursor });
      if (requestId !== historyRequestRef.current) return;
      if (!result) {
        setHistory({ records: localHistory, total: localHistory.length, nextCursor: null, hasMore: false, loading: false, loaded: true, error: '' });
        return;
      }
      setHistory((current) => ({
        records: append ? [...current.records, ...(result.records || [])] : (result.records || []),
        total: Number(result.total || 0),
        nextCursor: result.nextCursor ?? null,
        hasMore: !!result.hasMore,
        loading: false,
        loaded: true,
        error: '',
      }));
    } catch (error) {
      if (requestId !== historyRequestRef.current) return;
      setHistory((current) => ({
        ...current,
        records: append ? current.records : [],
        total: append ? current.total : 0,
        loading: false,
        loaded: true,
        error: String(error?.message || error || ''),
      }));
    }
  };

  const showMoreHistory = async () => {
    if (hiddenLoadedHistory) {
      setVisibleCount((count) => count + 8);
      return;
    }
    if (history.hasMore) {
      await loadHistory({ append: true });
      setVisibleCount((count) => count + 8);
    }
  };

  useEffect(() => {
    if (!open) return;
    setVisibleCount(8);
    loadHistory();
  }, [open, month, historyKey]);

  return (
    <section className={'card inbox-policy-card policy-settings-v2 ' + (open ? 'open' : '')}>
      <button type="button" className="inbox-policy-head policy-settings-head" onClick={() => setOpen(!open)}>
        <span>
          <strong>차단 기준</strong>
          <small>반복 제출을 차단할 조건과 중복 연락처 처리 방식을 설정합니다.</small>
          <em className="policy-summary-chip">차단 정책 {activePolicyCount}개 사용 중</em>
        </span>
        <em className="policy-toggle-label">{open ? '접기' : '설정 열기'}</em>
      </button>

      {open && (
        <div className="inbox-policy-body policy-settings-body">
          <section className="policy-settings-section">
            <header>
              <span>01</span>
              <div>
                <strong>자동 차단</strong>
                <small>같은 사용자로 판단되는 반복 제출을 자동으로 막습니다.</small>
              </div>
            </header>
            <div className="inbox-policy-grid policy-settings-grid switches">
              <DuplicatePolicySwitch
                label="IP 중복 차단"
                description="같은 네트워크에서 제한 횟수를 넘기면 제출을 차단합니다."
                badge="공용 와이파이 환경 주의"
                checked={settings.rejectIpDuplicate}
                onChange={(value) => save({ rejectIpDuplicate: value })}
              />
              <DuplicatePolicySwitch
                label="브라우저 중복 차단"
                description="같은 기기와 브라우저에서 반복 제출하면 차단합니다."
                badge="권장"
                checked={settings.rejectCookieDuplicate}
                onChange={(value) => save({ rejectCookieDuplicate: value, cookieDuplicatePolicyExplicit: true, duplicatePolicyVersion: 2 })}
              />
            </div>
          </section>

          <section className="policy-settings-section">
            <header>
              <span>02</span>
              <div>
                <strong>반복 제출 기준</strong>
                <small>몇 번, 어느 기간 안에 제출했을 때 중복으로 판단할지 정합니다.</small>
              </div>
            </header>
            <div className="inbox-policy-grid policy-settings-grid rules">
              <DuplicatePolicySelect
                label="판정 횟수"
                description="동일 조건으로 이 횟수 이상 접수되면 중복으로 판단합니다."
                value={settings.formDuplicateLimitCount}
                options={DUPLICATE_COUNTS}
                onChange={(value) => save({ formDuplicateLimitCount: value })}
              />
              <DuplicatePolicySelect
                label="판정 기간"
                description="선택한 기간 안의 반복 접수만 중복 횟수에 포함합니다."
                badge="기본 24시간"
                value={settings.formDuplicateLimitWindow}
                options={DUPLICATE_WINDOWS}
                onChange={(value) => save({ formDuplicateLimitWindow: value })}
              />
              <DuplicatePolicySelect
                label="연락처·이메일 중복"
                description="같은 연락처나 이메일이 다시 들어왔을 때 처리 방법입니다."
                badge={settings.phoneEmailMode === 'block' ? '강한 차단' : '안전한 기본값'}
                value={settings.phoneEmailMode}
                options={CONTACT_OPTIONS}
                onChange={(value) => save({ phoneEmailMode: value })}
              />
              <div className="policy-current-rule">
                <span>현재 적용 기준</span>
                <strong>{DUPLICATE_COUNTS.find(([value]) => value === settings.formDuplicateLimitCount)?.[1]} · {DUPLICATE_WINDOWS.find(([value]) => value === settings.formDuplicateLimitWindow)?.[1]}</strong>
                <small>설정 변경은 다음 접수부터 바로 반영됩니다.</small>
              </div>
            </div>
          </section>

          <section className="inbox-policy-history policy-history-v2">
            <div className="inbox-policy-history-head policy-history-head-v2">
              <span>
                <strong>차단 내역</strong>
                <small>자동 차단되거나 중복으로 판정된 접수를 기간별로 확인합니다.</small>
              </span>
              <div>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
                <button type="button" disabled={history.loading} onClick={() => loadHistory()}>{history.loading ? '조회 중' : '조회'}</button>
              </div>
            </div>

            <div className="policy-history-table-head" aria-hidden="true">
              <span>날짜</span>
              <span>페이지</span>
              <span>차단 사유</span>
            </div>

            {history.error && <span className="inbox-policy-error">{history.error}</span>}
            {history.loading ? (
              <span className="inbox-policy-empty policy-empty-v2">차단 내역을 불러오는 중입니다.</span>
            ) : !visibleHistory.length ? (
              <span className="inbox-policy-empty policy-empty-v2">
                <b>차단 내역이 없습니다.</b>
                <small>선택한 기간에 자동 차단된 접수가 없습니다.</small>
              </span>
            ) : (
              <ul>
                {displayedHistory.map((item, index) => (
                  <li key={item.id || index}>
                    <b>{String(item.date || item.createdAt || '').slice(0, 10) || '-'}</b>
                    <em>{String(item.pageSlug || item.page || item.form || item.formId || '-')}</em>
                    <small>{blockedReason(item.reason || item.duplicateReason)}{blockedSignalSummary(item) ? ' · ' + blockedSignalSummary(item) : ''}</small>
                  </li>
                ))}
              </ul>
            )}

            {history.loaded && visibleHistory.length > 0 && (
              <div className="inbox-policy-history-footer">
                <small className="inbox-policy-more">전체 {history.total || visibleHistory.length}건 · {displayedHistory.length}건 표시</small>
                {(hiddenLoadedHistory || history.hasMore) && (
                  <button type="button" className="inbox-policy-more-button" disabled={history.loading} onClick={showMoreHistory}>
                    {history.loading ? '조회 중' : '더보기'}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
