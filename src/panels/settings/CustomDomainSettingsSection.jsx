import { useMemo, useState } from 'react';
import { Check, Clipboard, Globe2, Trash2 } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';

const DNS_TARGET = 'inlet-8mr.pages.dev';
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
  integrations,
  openSection,
  setOpenSection,
  updateIntegrations,
}) {
  const savedDomain = integrations?.domain || {};
  const [hostname, setHostname] = useState(savedDomain.hostname || '');
  const [notice, setNotice] = useState('');
  const normalizedHostname = useMemo(() => normalizeHostname(hostname), [hostname]);
  const recordName = useMemo(() => dnsRecordName(normalizedHostname), [normalizedHostname]);
  const savedHostname = normalizeHostname(savedDomain.hostname || '');

  const saveDomain = () => {
    if (!isValidHostname(normalizedHostname)) {
      setNotice('도메인을 example.com 또는 landing.example.com 형식으로 입력하세요.');
      return;
    }
    updateIntegrations('domain', {
      hostname: normalizedHostname,
      dnsTarget: DNS_TARGET,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
    setHostname(normalizedHostname);
    setNotice('연결 요청을 저장했습니다. 아래 DNS 레코드를 등록하세요.');
  };

  const removeDomain = () => {
    updateIntegrations('domain', {
      hostname: '',
      dnsTarget: DNS_TARGET,
      status: 'disconnected',
      requestedAt: '',
    });
    setHostname('');
    setNotice('개인 도메인 연결 요청을 삭제했습니다.');
  };

  const copyValue = async (value, label) => {
    try {
      await copyText(value);
      setNotice(`${label}을 복사했습니다.`);
    } catch {
      setNotice('복사하지 못했습니다. 값을 직접 선택해 복사하세요.');
    }
  };

  return (
    <SettingsSection
      id="domain"
      title="개인 도메인"
      description="도메인 연결과 DNS 설정"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-domain-card"
    >
      <div className="custom-domain-settings">
        <section className="custom-domain-entry">
          <header>
            <Globe2 size={18} aria-hidden="true" />
            <div>
              <strong>연결할 도메인</strong>
              <small>구매한 도메인 주소만 입력하세요.</small>
            </div>
          </header>

          <label className="custom-domain-field">
            <span>도메인</span>
            <div>
              <input
                type="text"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="example.com 또는 landing.example.com"
                autoComplete="off"
                spellCheck="false"
              />
              <button type="button" className="custom-domain-primary" onClick={saveDomain}>저장</button>
              {savedHostname && (
                <button type="button" className="custom-domain-remove" onClick={removeDomain} aria-label="개인 도메인 삭제">
                  <Trash2 size={16} aria-hidden="true" />
                  삭제
                </button>
              )}
            </div>
          </label>

          <div className={`custom-domain-status ${savedHostname ? 'is-pending' : ''}`}>
            <span aria-hidden="true" />
            <strong>{savedHostname ? 'DNS 설정 대기' : '연결된 도메인 없음'}</strong>
            {savedHostname && <small>{savedHostname}</small>}
          </div>
        </section>

        <section className="custom-domain-dns">
          <header>
            <div>
              <strong>DNS 레코드</strong>
              <small>도메인을 구매한 업체의 DNS 관리 화면에 아래 값을 추가하세요.</small>
            </div>
            <button
              type="button"
              className="custom-domain-copy-all"
              onClick={() => copyValue(`CNAME\t${recordName}\t${DNS_TARGET}`, 'DNS 레코드')}
            >
              <Clipboard size={15} aria-hidden="true" />
              전체 복사
            </button>
          </header>

          <div className="custom-domain-dns-table" role="table" aria-label="개인 도메인 DNS 레코드">
            <div role="row">
              <span role="columnheader">유형</span>
              <span role="columnheader">호스트/이름</span>
              <span role="columnheader">대상/값</span>
            </div>
            <div role="row">
              <strong role="cell">CNAME</strong>
              <code role="cell">{normalizedHostname ? recordName : '@ 또는 서브도메인'}</code>
              <code role="cell">{DNS_TARGET}</code>
            </div>
          </div>

          <div className="custom-domain-dns-actions">
            <button type="button" onClick={() => copyValue(recordName, '호스트 값')} disabled={!normalizedHostname}>
              <Clipboard size={14} aria-hidden="true" /> 호스트 복사
            </button>
            <button type="button" onClick={() => copyValue(DNS_TARGET, 'DNS 대상 주소')}>
              <Clipboard size={14} aria-hidden="true" /> 대상 주소 복사
            </button>
          </div>

          <p className="custom-domain-note">
            <Check size={15} aria-hidden="true" />
            루트 도메인은 호스트를 <b>@</b>로 입력합니다. 외부 DNS 업체가 루트 CNAME을 지원하지 않으면 ALIAS/ANAME 또는 CNAME Flattening을 사용해야 합니다.
          </p>
        </section>

        {notice && <p className="custom-domain-notice" role="status">{notice}</p>}
      </div>
    </SettingsSection>
  );
}
