import { Clipboard, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  checkPageDomain,
  detachPageDomain,
  domainOperationMessage,
  verifyPageDomain,
} from '../../lib/pageDomainRepository.js';
import SettingsSection from './SettingsSection.jsx';

const DNS_TARGET = 'inlet-8mr.pages.dev';
const MULTI_PART_SUFFIXES = ['co.kr', 'or.kr', 'go.kr', 'ne.kr', 'ac.kr', 're.kr', 'pe.kr', 'co.uk', 'com.au', 'co.jp'];

function normalizeHostname(value = '') {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '');
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

function domainState(domain, hostname) {
  const rawStatus = String(domain?.domainStatus || domain?.status || '').toLowerCase();
  if (!hostname || rawStatus === 'disconnected') return { key: 'empty', label: '미연결' };
  if (['connected', 'active', 'verified', 'ready'].includes(rawStatus)) return { key: 'connected', label: '연결됨' };
  if (['error', 'failed', 'invalid'].includes(rawStatus)) return { key: 'error', label: '확인 필요' };
  if (['verifying', 'checking', 'processing'].includes(rawStatus)) return { key: 'verifying', label: '확인 중' };
  return { key: 'pending', label: 'DNS 대기' };
}

function nextDomainConfig(savedDomain, hostname, dnsTarget) {
  return {
    ...(savedDomain || {}),
    hostname,
    dnsTarget: dnsTarget || DNS_TARGET,
    status: 'pending',
    httpsManaged: true,
    sslManaged: true,
    sslStatus: 'pending',
    requestedAt: new Date().toISOString(),
  };
}

function clearedDomainConfig(savedDomain, dnsTarget = DNS_TARGET) {
  return {
    ...(savedDomain || {}),
    hostname: '',
    dnsTarget: dnsTarget || DNS_TARGET,
    status: 'disconnected',
    httpsManaged: false,
    sslManaged: false,
    sslStatus: 'not_enabled',
    requestedAt: '',
  };
}

function pageWithDomain(page, domain) {
  return {
    ...(page || {}),
    integrations: {
      ...(page?.integrations || {}),
      domain,
    },
  };
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
  onSavePage,
  page,
}) {
  const savedDomain = integrations?.domain || {};
  const savedHostname = normalizeHostname(savedDomain.hostname || '');
  const [hostname, setHostname] = useState(savedHostname);
  const [serverDomain, setServerDomain] = useState(null);
  const [dnsState, setDnsState] = useState(null);
  const [operationBusy, setOperationBusy] = useState('');
  const [notice, setNotice] = useState('');
  const normalizedHostname = useMemo(() => normalizeHostname(hostname), [hostname]);
  const displayHostname = String(serverDomain?.domainStatus || '') === 'disconnected'
    ? savedHostname
    : normalizeHostname(serverDomain?.hostname || savedHostname);
  const dnsTarget = normalizeHostname(dnsState?.target || savedDomain.dnsTarget || DNS_TARGET) || DNS_TARGET;
  const recordName = useMemo(() => dnsRecordName(normalizedHostname || displayHostname), [normalizedHostname, displayHostname]);
  const apexDomain = recordName === '@';
  const status = domainState(serverDomain || savedDomain, displayHostname);
  const hostnameInvalid = Boolean(hostname.trim()) && !isValidHostname(normalizedHostname);
  const providerSslStatus = String(serverDomain?.sslStatus || '').toLowerCase();
  const canOperateServer = Boolean(authUser?.session && page?.id && typeof onSavePage === 'function');

  useEffect(() => {
    setHostname(savedHostname);
  }, [savedHostname]);

  useEffect(() => {
    let cancelled = false;
    if (!canOperateServer) {
      setServerDomain(null);
      return () => { cancelled = true; };
    }
    checkPageDomain(page, authUser, savedHostname)
      .then((result) => {
        if (cancelled) return;
        setServerDomain(result?.current || null);
        setDnsState(result?.dns || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authUser?.session, canOperateServer, page?.id, page?.projectId, savedHostname]);

  const saveAndConnectDomain = async () => {
    if (typeof onSavePage !== 'function') {
      setNotice('페이지 저장 연결이 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }
    if (!isValidHostname(normalizedHostname)) {
      setNotice('도메인 주소를 확인해주세요.');
      return;
    }
    setOperationBusy('connect');
    setNotice('');
    try {
      const checked = await checkPageDomain(page, authUser, normalizedHostname);
      const target = normalizeHostname(checked?.dns?.target || dnsTarget) || DNS_TARGET;
      const domain = nextDomainConfig(savedDomain, normalizedHostname, target);
      const nextPage = pageWithDomain(page, domain);

      const saved = await onSavePage(nextPage);
      if (saved?.ok === false) {
        setNotice('페이지 저장이 완료되지 않아 도메인 연결을 시작하지 않았습니다.');
        return;
      }

      const savedPage = saved?.page || nextPage;
      const verified = await verifyPageDomain(savedPage, authUser, normalizedHostname);
      setHostname(normalizedHostname);
      setServerDomain(verified?.current || checked?.current || null);
      setDnsState(verified?.dns || checked?.dns || null);
      setNotice(verified?.message || '도메인 연결 상태를 확인했습니다.');
    } catch (error) {
      setNotice(domainOperationMessage(error));
    } finally {
      setOperationBusy('');
    }
  };

  const refreshDomainStatus = async () => {
    if (!savedHostname && !serverDomain?.hostname) {
      setNotice('먼저 도메인을 연결해주세요.');
      return;
    }
    setOperationBusy('verify');
    setNotice('');
    try {
      const verified = await verifyPageDomain(page, authUser, serverDomain?.hostname || savedHostname);
      setServerDomain(verified?.current || null);
      setDnsState(verified?.dns || null);
      setNotice(verified?.message || '도메인 연결 상태를 확인했습니다.');
    } catch (error) {
      setNotice(domainOperationMessage(error));
    } finally {
      setOperationBusy('');
    }
  };

  const removeDomain = async () => {
    if (typeof onSavePage !== 'function') {
      setNotice('페이지 저장 연결이 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }
    setOperationBusy('detach');
    setNotice('');
    try {
      const detached = await detachPageDomain(page, authUser);
      const domain = clearedDomainConfig(savedDomain, dnsTarget);
      const nextPage = pageWithDomain(page, domain);
      if (typeof onSavePage === 'function') {
        const saved = await onSavePage(nextPage);
        if (saved?.ok === false) {
          setServerDomain(detached?.current || null);
          setNotice('외부 도메인 연결은 해제됐지만 페이지 저장이 완료되지 않았습니다. 해제를 다시 눌러 저장을 완료해주세요.');
          return;
        }
      }
      setHostname('');
      setServerDomain(detached?.current || null);
      setNotice(detached?.message || '도메인 연결을 해제했습니다.');
    } catch (error) {
      setNotice(domainOperationMessage(error, '도메인 연결을 해제하지 못했습니다.'));
    } finally {
      setOperationBusy('');
    }
  };


  const copyDns = async () => {
    if (apexDomain) {
      setNotice('루트 도메인은 도메인 업체에서 네임서버를 Cloudflare로 변경해야 합니다.');
      return;
    }
    try {
      await copyText(`CNAME\t${recordName}\t${dnsTarget}`);
      setNotice('DNS 정보 복사 완료');
    } catch {
      setNotice('복사하지 못했습니다.');
    }
  };

  const sslLabel = providerSslStatus === 'active'
    ? '인증서 활성'
    : providerSslStatus === 'failed'
      ? 'SSL 확인 필요'
      : providerSslStatus === 'pending'
        ? 'SSL 확인 중'
        : displayHostname ? 'SSL 대기' : '도메인 연결 후 자동 적용';

  return (
    <SettingsSection id="domain" className="settings-domain-section">
      <div className="domain-settings-screen">
        <section className="domain-setting-row domain-dns-row-v2">
          <div className="domain-setting-label">
            <strong>DNS</strong>
          </div>
          <div className="domain-dns-values">
            <div><span>유형</span><code>{apexDomain ? '네임서버' : 'CNAME'}</code></div>
            <div><span>호스트</span><code>{recordName}</code></div>
            <div><span>대상</span><code>{apexDomain ? 'Cloudflare' : dnsTarget}</code></div>
          </div>
          <button type="button" className="settings-secondary-button compact" onClick={copyDns}>
            <Clipboard size={14} aria-hidden="true" /> {apexDomain ? '안내' : '복사'}
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
              disabled={operationBusy === 'detach'}
            />
            <button
              type="button"
              className="settings-primary-button"
              disabled={Boolean(operationBusy) || hostnameInvalid || !canOperateServer}
              onClick={saveAndConnectDomain}
            >
              {operationBusy === 'connect' ? '연결 중' : '연결'}
            </button>
            {displayHostname && (
              <button
                type="button"
                className="settings-secondary-button"
                disabled={Boolean(operationBusy)}
                onClick={refreshDomainStatus}
              >
                <RefreshCw size={14} aria-hidden="true" /> {operationBusy === 'verify' ? '확인 중' : '상태 확인'}
              </button>
            )}
            {displayHostname && (
              <button
                type="button"
                className="settings-secondary-button"
                disabled={Boolean(operationBusy)}
                onClick={removeDomain}
              >
                <Trash2 size={14} aria-hidden="true" /> {operationBusy === 'detach' ? '해제 중' : '해제'}
              </button>
            )}
          </div>
          {hostnameInvalid && <small className="settings-field-error domain-field-error">도메인 형식을 확인하세요.</small>}
          {!canOperateServer && <small className="settings-field-error domain-field-error">페이지를 먼저 저장한 뒤 개인 도메인을 연결할 수 있습니다.</small>}
        </section>

        <section className="domain-setting-row domain-ssl-row">
          <div className="domain-setting-label">
            <strong>HTTPS · SSL</strong>
            <span>{sslLabel}</span>
          </div>
          <div className="domain-ssl-action">
            {providerSslStatus === 'active' ? (
              <span className="settings-status-badge success">적용</span>
            ) : displayHostname ? (
              <span className="settings-status-badge">{providerSslStatus === 'failed' ? '확인 필요' : '대기'}</span>
            ) : (
              <span className="settings-status-badge">자동 적용</span>
            )}
          </div>
        </section>

        {serverDomain?.lastCheckedAt && (
          <p className="settings-message" role="status">최근 확인: {new Date(serverDomain.lastCheckedAt).toLocaleString('ko-KR')}</p>
        )}
        {notice && <p className="settings-message" role="status">{notice}</p>}
      </div>
    </SettingsSection>
  );
}
