import { Choice, Field } from '../../editor/controls.jsx';
import {
  pageDomainStatusLabel,
  pageDomainStatusTone,
  pagePublicUrl,
} from '../../lib/pageDomains.js';
import SettingsSection from './SettingsSection.jsx';
import './PageDomainSettingsSection.css';

function checkedAtLabel(value = '') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PageDomainSettingsSection({
  domainSettings,
  openSection,
  setOpenSection,
}) {
  const {
    checking,
    disabled,
    dns,
    draft,
    issues,
    saveDomain,
    saving,
    setCustomDomain,
    setDomainType,
    verifyDomain,
  } = domainSettings;
  const statusTone = pageDomainStatusTone(draft.domainStatus);
  const checkedAt = checkedAtLabel(draft.domainLastCheckedAt);

  return (
    <SettingsSection
      id="domain"
      title="페이지 도메인"
      badge={draft.domainType === 'custom' ? pageDomainStatusLabel(draft.domainStatus) : ''}
      openSection={openSection}
      setOpenSection={setOpenSection}
      onSave={disabled ? undefined : saveDomain}
    >
      <div className="settings-grid page-domain-settings">
        <Choice
          label="주소 방식"
          value={draft.domainType}
          onChange={disabled ? () => {} : setDomainType}
          options={[
            ['default', '페이지로 주소'],
            ['custom', '개인 도메인'],
          ]}
        />

        {draft.domainType === 'default' ? (
          <Field
            label="공개 주소"
            value={pagePublicUrl(draft)}
            disabled
            onChange={() => {}}
          />
        ) : (
          <>
            <Field
              label="개인 도메인"
              value={draft.customDomain}
              disabled={disabled || saving || checking}
              placeholder="www.example.com"
              onChange={setCustomDomain}
            />
            <div className={`page-domain-status page-domain-status-${statusTone}`} role="status">
              <div>
                <strong>{pageDomainStatusLabel(draft.domainStatus)}</strong>
                {checkedAt && <small>마지막 확인 {checkedAt}</small>}
              </div>
              <span>SSL: {draft.sslStatus === 'active' ? '적용 완료' : draft.sslStatus === 'failed' ? '발급 실패' : '발급 대기'}</span>
            </div>
            {issues.length > 0 && <p className="settings-inline-error">{issues[0]}</p>}
            {draft.domainFailureReason && <p className="settings-inline-error">{draft.domainFailureReason}</p>}
            <div className="page-domain-dns-guide">
              <div className="page-domain-dns-title">
                <strong>DNS 연결</strong>
                {dns?.configured && (
                  <span className={dns.matched ? 'is-matched' : 'is-pending'}>
                    {dns.matched ? '확인 완료' : '확인 필요'}
                  </span>
                )}
              </div>
              {dns?.configured ? (
                <>
                  <p><code>{dns.type}</code> 레코드로 <code>{dns.host}</code>를 <code>{dns.target}</code>에 연결하세요.</p>
                  {dns.error && <p className="settings-inline-error">{dns.error}</p>}
                  {dns.validation?.name && dns.validation?.value && (
                    <p><code>TXT</code> 검증값: <code>{dns.validation.name}</code> → <code>{dns.validation.value}</code></p>
                  )}
                </>
              ) : (
                <p>도메인을 저장하면 운영 연결값과 확인 상태가 표시됩니다.</p>
              )}
            </div>
            <button
              type="button"
              className="page-domain-check-button"
              disabled={disabled || saving || checking || issues.length > 0}
              onClick={verifyDomain}
            >
              {checking ? '연결 확인 중...' : '연결 상태 확인'}
            </button>
          </>
        )}

        {disabled && <p className="settings-inline-note">소유자 계정만 도메인을 변경할 수 있습니다.</p>}
        {saving && <p className="settings-inline-note">도메인 저장과 연결 등록을 진행 중입니다.</p>}
      </div>
    </SettingsSection>
  );
}
