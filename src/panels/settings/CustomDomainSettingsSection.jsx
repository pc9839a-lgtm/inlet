import { useMemo, useState } from 'react';
import { Check, Clipboard, Globe2, ShieldCheck, Trash2 } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';
import './CustomDomainBilling.css';

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
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return '@';
  const matchedSuffix = MULTI_PART_SUFFIXES.find((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
  const rootLabelCount = matchedSuffix ? matchedSuffix.split('.').length + 1 : 2;
  const subdomainLabels = labels.slice(0, Math.max(0, labels.length - rootLabelCount));
  return subdomainLabels.length ? subdomainLabels.join('.') : '@';
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

export default function CustomDomainSettingsSection({
  authUser,
  integrations,
  openSection,
  setOpenSection,
  updateIntegrations,
}) {
  const savedDomain = integrations?.domain || {};
  const [hostname, setHostname] = useState(savedDomain.hostname || '');
  const [notice, setNotice] = useState('');
  const { finance, loading, busy, error: financeError, checkout } = useAccountFinance(authUser);
  const normalizedHostname = useMemo(() => normalizeHostname(hostname), [hostname]);
  const recordName = useMemo(() => dnsRecordName(normalizedHostname), [normalizedHostname]);
  const savedHostname = normalizeHostname(savedDomain.hostname || '');
  const sslEnabled = finance?.domain?.enabled === true;
  const sslIncludedByPlan = finance?.domain?.includedByPlan === true;
  const sslLoading = loading && !finance;
  const checkoutBusy = busy === `domain:${DOMAIN_PRODUCT}`;

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

  const copyValue = async (value, label) => {
    try {
      await copyText(value);
      setNotice(`${label} 복사 완료`);
    } catch {
      setNotice('복사하지 못했습니다.');
    }
  };

  return (
    <SettingsSection
      id="domain"
      title="개인 도메인"
      description="도메인 연결은 무료 · HTTPS(SSL)는 선택"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-domain-card"
    >
      <div className="custom-domain-settings compact-domain-settings">
        <section className="custom-domain-entry is-enabled">
          <header className="custom-domain-title-row">
            <div className="custom-domain-title-icon"><Globe2 size={18} aria-hidden="true" /></div>
            <div>
              <strong>도메인 연결</strong>
              <span className="custom-domain-free-badge">무료</span>
            </div>
          </header>

          <label className="custom-domain-field compact">
            <span>도메인</span>
            <div>
              <input
                type="text"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="example.com"
                autoComplete="off"
                spellCheck="false"
              />
              <button type="button" className="custom-domain-primary" onClick={saveDomain}>연결</button>
              {savedHostname && (
                <button type="button" className="custom-domain-remove" onClick={removeDomain} aria-label="개인 도메인 삭제">
                  <Trash2 size={15} aria-hidden="true" />
                  해제
                </button>
              )}
            </div>
          </label>

          <div className={`custom-domain-status ${savedHostname ? 'is-pending' : ''}`}>
            <span aria-hidden="true" />
            <strong>{savedHostname ? 'DNS 연결 대기' : '연결된 도메인 없음'}</strong>
            {savedHostname && <small>{savedHostname}</small>}
          </div>
        </section>

        <section className={`custom-domain-ssl-card ${sslEnabled ? 'is-active' : ''}`}>
          <div className="custom-domain-ssl-icon"><ShieldCheck size={18} aria-hidden="true" /></div>
          <div className="custom-domain-ssl-copy">
            <strong>HTTPS · SSL</strong>
            <small>{sslEnabled ? (sslIncludedByPlan ? '프로 요금제 포함' : 'SSL 관리 이용 중') : '월 1,000원'}</small>
          </div>
          <span className={`custom-domain-ssl-state ${sslEnabled ? 'active' : ''}`}>{sslEnabled ? '적용' : '선택'}</span>
          {!sslEnabled && !sslLoading && (
            <button type="button" className="custom-domain-ssl-button" disabled={checkoutBusy} onClick={startSslCheckout}>
              {checkoutBusy ? '이동 중' : 'SSL 신청'}
            </button>
          )}
        </section>

        {savedHostname && (
          <section className="custom-domain-dns compact">
            <header>
              <div>
                <strong>DNS 설정</strong>
                <small>CNAME 한 줄만 등록하세요.</small>
              </div>
              <button
                type="button"
                className="custom-domain-copy-all"
                onClick={() => copyValue(`CNAME\t${recordName}\t${DNS_TARGET}`, 'DNS')}
              >
                <Clipboard size={14} aria-hidden="true" />
                복사
              </button>
            </header>

            <div className="custom-domain-dns-table compact" role="table" aria-label="개인 도메인 DNS 레코드">
              <div role="row">
                <strong role="cell">CNAME</strong>
                <code role="cell">{recordName}</code>
                <code role="cell">{DNS_TARGET}</code>
              </div>
            </div>

            <p className="custom-domain-note compact">
              <Check size={14} aria-hidden="true" />
              루트 도메인은 호스트를 <b>@</b>로 입력합니다.
            </p>
          </section>
        )}

        {financeError && <p className="custom-domain-notice" role="alert">{financeError}</p>}
        {notice && <p className="custom-domain-notice" role="status">{notice}</p>}
      </div>
    </SettingsSection>
  );
}
