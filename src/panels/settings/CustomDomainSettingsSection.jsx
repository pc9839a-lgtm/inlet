import { useMemo, useState } from 'react';
import { Check, Clipboard, Globe2, ShieldCheck, Trash2 } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

const DNS_TARGET = 'inlet-8mr.pages.dev';
const DOMAIN_PRODUCT = 'pagero_domain_monthly';
const MULTI_PART_SUFFIXES = ['co.kr', 'or.kr', 'go.kr', 'ne.kr', 'ac.kr', 're.kr', 'pe.kr', 'co.uk', 'com.au', 'co.jp'];

function normalizeHostname(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');
}

function isValidHostname(value = '') {
  if (!value || value.length > 253 || !value.includes('.')) return false;
  return value.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part));
}

function dnsRecordName(hostname = '') {
  if (!hostname) return '@';
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return '@';
  const matchedSuffix = MULTI_PART_SUFFIXES.find((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
  const rootLabelCount = matchedSuffix ? matchedSuffix.split('.').length + 1 : 2;
  const subdomainLabels = labels.slice(0, Math.max(0, labels.length - rootLabelCount));
  return subdomainLabels.length ? subdomainLabels.join('.') : '@';
}

function domainState(savedDomain, savedHostname) {
  if (!savedHostname) return { key: 'empty', label: '미연결', detail: '도메인을 입력하고 연결을 시작하세요.', step: 0 };
  const status = String(savedDomain?.status || 'pending').toLowerCase();
  if (['connected', 'active', 'verified', 'ready'].includes(status)) {
    return { key: 'connected', label: '연결됨', detail: 'DNS 연결이 확인되었습니다.', step: 3 };
  }
  if (['error', 'failed', 'invalid'].includes(status)) {
    return { key: 'error', label: '확인 필요', detail: 'DNS 레코드가 올바른지 확인하세요.', step: 1 };
  }
  if (['verifying', 'checking', 'processing'].includes(status)) {
    return { key: 'verifying', label: '확인 중', detail: 'DNS 레코드를 확인하고 있습니다.', step: 2 };
  }
  return { key: 'pending', label: 'DNS 대기', detail: 'DNS 업체에 아래 CNAME 레코드를 등록하세요.', step: 1 };
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export default function CustomDomainSettingsSection({ authUser, integrations, updateIntegrations }) {
  const savedDomain = integrations?.domain || {};
  const [hostname, setHostname] = useState(savedDomain.hostname || '');
  const [notice, setNotice] = useState('');
  const { finance, loading, busy, error: financeError, checkout } = useAccountFinance(authUser);
  const normalizedHostname = useMemo(() => normalizeHostname(hostname), [hostname]);
  const recordName = useMemo(() => dnsRecordName(normalizedHostname), [normalizedHostname]);
  const savedHostname = normalizeHostname(savedDomain.hostname || '');
  const status = domainState(savedDomain, savedHostname);
  const sslEnabled = finance?.domain?.enabled === true;
  const sslIncludedByPlan = finance?.domain?.includedByPlan === true;
  const sslLoading = loading && !finance;
  const checkoutBusy = busy === `domain:${DOMAIN_PRODUCT}`;
  const hostnameInvalid = Boolean(hostname.trim()) && !isValidHostname(normalizedHostname);

  const saveDomain = () => {
    if (!isValidHostname(normalizedHostname)) {
      setNotice('도메인 주소를 확인해주세요.');
      return;
    }
    updateIntegrations('domain', {
      hostname: normalizedHostname,
      dnsTarget: DNS_TARGET,
      status: 'pending',
      httpsManaged: sslEnabled,
      sslManaged: sslEnabled,
      sslStatus: sslEnabled ? 'pending' : 'not_enabled',
      requestedAt: new Date().toISOString(),
    });
    setHostname(normalizedHostname);
    setNotice('도메인 연결 요청을 저장했습니다.');
  };

  const removeDomain = () => {
    updateIntegrations('domain', {
      hostname: '',
      dnsTarget: DNS_TARGET,
      status: 'disconnected',
      httpsManaged: false,
      sslManaged: false,
      sslStatus: 'not_enabled',
      requestedAt: '',
    });
    setHostname('');
    setNotice('도메인 연결을 해제했습니다.');
  };

  const startSslCheckout = async () => {
    setNotice('');
    const moved = await checkout('domain', DOMAIN_PRODUCT);
    if (!moved) setNotice('결제 화면을 열지 못했습니다.');
  };

  const copyDns = async () => {
    try {
      await copyText(`CNAME\t${recordName}\t${DNS_TARGET}`);
      setNotice('DNS 정보 복사 완료');
    } catch {
      setNotice('복사하지 못했습니다.');
    }
  };

  return (
    <SettingsSection id="domain" className="settings-domain-section">
      <div className="settings-stack">
        <section className="settings-surface domain-dns-surface">
          <div className="settings-surface-head">
            <div>
              <strong>1. DNS 설정</strong>
              <small>도메인 연결 전에도 필요한 값을 먼저 확인할 수 있습니다.</small>
            </div>
            <button type="button" className="settings-secondary-button compact" onClick={copyDns}>
              <Clipboard size={15} aria-hidden="true" /> DNS 복사
            </button>
          </div>

          <div className="domain-dns-grid" role="table" aria-label="개인 도메인 DNS 레코드">
            <div className="domain-dns-head" role="row">
              <span role="columnheader">유형</span>
              <span role="columnheader">호스트</span>
              <span role="columnheader">대상 주소</span>
            </div>
            <div className="domain-dns-row" role="row">
              <code role="cell">CNAME</code>
              <code role="cell">{recordName}</code>
              <code role="cell">{DNS_TARGET}</code>
            </div>
          </div>

          <p className="settings-help-line">
            <Check size={15} aria-hidden="true" />
            루트 도메인은 호스트를 <b>@</b>로 입력하고, 서브도메인은 입력한 주소에 맞춰 자동 표시됩니다.
          </p>
        </section>

        <section className="settings-surface domain-connect-surface">
          <div className="settings-surface-head">
            <div className="settings-icon-title">
              <span className="settings-icon-box"><Globe2 size={19} aria-hidden="true" /></span>
              <div>
                <strong>2. 도메인 연결</strong>
                <small>도메인 연결 자체는 무료입니다.</small>
              </div>
            </div>
            <span className="settings-status-badge success">무료</span>
          </div>

          <label className="settings-control-group">
            <span>개인 도메인</span>
            <div className="settings-inline-control domain-inline-control">
              <input
                type="text"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="example.com"
                autoComplete="off"
                spellCheck="false"
                aria-invalid={hostnameInvalid}
              />
              <button type="button" className="settings-primary-button" onClick={saveDomain}>도메인 연결</button>
              {savedHostname && (
                <button type="button" className="settings-secondary-button" onClick={removeDomain}>
                  <Trash2 size={15} aria-hidden="true" /> 해제
                </button>
              )}
            </div>
            {hostnameInvalid && <small className="settings-field-error">example.com 또는 www.example.com 형식으로 입력하세요.</small>}
          </label>

          <div className={`domain-state-card state-${status.key}`}>
            <div>
              <span>현재 상태</span>
              <strong>{status.label}</strong>
              <small>{status.detail}</small>
            </div>
            {savedHostname && <code>{savedHostname}</code>}
          </div>

          <div className="domain-steps" aria-label="도메인 연결 단계">
            {['도메인 입력', 'DNS 등록', '확인 중', '연결 완료'].map((label, index) => (
              <div key={label} className={index <= status.step ? 'active' : ''}>
                <i aria-hidden="true">{index + 1}</i>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`settings-surface domain-ssl-surface ${sslEnabled ? 'active' : ''}`}>
          <div className="settings-icon-title">
            <span className="settings-icon-box"><ShieldCheck size={19} aria-hidden="true" /></span>
            <div>
              <strong>3. HTTPS · SSL 관리</strong>
              <small>{sslEnabled ? (sslIncludedByPlan ? '프로 요금제에 포함되어 있습니다.' : 'SSL 관리 이용 중입니다.') : '인증서 발급·자동 갱신·HTTPS 관리를 월 1,000원에 제공합니다.'}</small>
            </div>
          </div>
          <div className="settings-row-action">
            <span className={`settings-status-badge ${sslEnabled ? 'success' : ''}`}>{sslEnabled ? '적용' : '선택'}</span>
            {!sslEnabled && !sslLoading && (
              <button type="button" className="settings-primary-button" disabled={checkoutBusy} onClick={startSslCheckout}>
                {checkoutBusy ? '이동 중' : 'SSL 신청'}
              </button>
            )}
          </div>
        </section>

        {financeError && <p className="settings-message error" role="alert">{financeError}</p>}
        {notice && <p className="settings-message" role="status">{notice}</p>}
      </div>
    </SettingsSection>
  );
}
