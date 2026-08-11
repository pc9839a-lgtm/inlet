import { Clipboard, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

const DNS_TARGET = 'inlet-8mr.pages.dev';
const DOMAIN_PRODUCT = 'pagero_domain_monthly';
const MULTI_PART_SUFFIXES = ['co.kr', 'or.kr', 'go.kr', 'ne.kr', 'ac.kr', 're.kr', 'pe.kr', 'co.uk', 'com.au', 'co.jp'];

function normalizeHostname(value = '') {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '');
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
  if (!savedHostname) return { key: 'empty', label: '미연결' };
  const status = String(savedDomain?.status || 'pending').toLowerCase();
  if (['connected', 'active', 'verified', 'ready'].includes(status)) return { key: 'connected', label: '연결됨' };
  if (['error', 'failed', 'invalid'].includes(status)) return { key: 'error', label: '확인 필요' };
  if (['verifying', 'checking', 'processing'].includes(status)) return { key: 'verifying', label: '확인 중' };
  return { key: 'pending', label: 'DNS 대기' };
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
      <div className="domain-settings-screen">
        <section className="domain-setting-row domain-dns-row-v2">
          <div className="domain-setting-label">
            <strong>DNS</strong>
            <span>먼저 DNS에 아래 CNAME을 등록하세요.</span>
          </div>
          <div className="domain-dns-values">
            <div><span>유형</span><code>CNAME</code></div>
            <div><span>호스트</span><code>{recordName}</code></div>
            <div><span>대상</span><code>{DNS_TARGET}</code></div>
          </div>
          <button type="button" className="settings-secondary-button compact" onClick={copyDns}>
            <Clipboard size={14} aria-hidden="true" /> 복사
          </button>
        </section>

        <section className="domain-setting-row">
          <div className="domain-setting-label">
            <strong>도메인</strong>
            <span className={`settings-status-badge ${status.key === 'connected' ? 'success' : ''}`}>{status.label}</span>
          </div>
          <div className="domain-connect-control">
            <input
              type="text"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              placeholder="example.com"
              autoComplete="off"
              spellCheck="false"
              aria-invalid={hostnameInvalid}
            />
            <button type="button" className="settings-primary-button" onClick={saveDomain}>연결</button>
            {savedHostname && (
              <button type="button" className="settings-secondary-button" onClick={removeDomain}>
                <Trash2 size={14} aria-hidden="true" /> 해제
              </button>
            )}
          </div>
          {hostnameInvalid && <small className="settings-field-error domain-field-error">도메인 형식을 확인하세요.</small>}
        </section>

        <section className="domain-setting-row domain-ssl-row">
          <div className="domain-setting-label">
            <strong>HTTPS · SSL</strong>
            <span>{sslIncludedByPlan ? '프로 요금제 포함' : sslEnabled ? '이용 중' : '월 1,000원'}</span>
          </div>
          <div className="domain-ssl-action">
            {sslEnabled || sslIncludedByPlan ? (
              <span className="settings-status-badge success">적용</span>
            ) : !sslLoading ? (
              <button type="button" className="settings-primary-button compact" disabled={checkoutBusy} onClick={startSslCheckout}>
                {checkoutBusy ? '이동 중' : 'SSL 신청'}
              </button>
            ) : null}
          </div>
        </section>

        {financeError && <p className="settings-message error" role="alert">{financeError}</p>}
        {notice && <p className="settings-message" role="status">{notice}</p>}
      </div>
    </SettingsSection>
  );
}
