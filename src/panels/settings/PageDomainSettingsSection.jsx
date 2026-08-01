import { Choice, Field } from '../../editor/controls.jsx';
import {
  pageDomainStatusLabel,
  pageDomainStatusTone,
  pagePublicUrl,
} from '../../lib/pageDomains.js';
import SettingsSection from './SettingsSection.jsx';

export default function PageDomainSettingsSection({
  domainSettings,
  openSection,
  setOpenSection,
}) {
  const {
    disabled,
    dns,
    draft,
    issues,
    saveDomain,
    saving,
    setCustomDomain,
    setDomainType,
  } = domainSettings;
  const statusTone = pageDomainStatusTone(draft.domainStatus);

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
              disabled={disabled || saving}
              placeholder="www.example.com"
              onChange={setCustomDomain}
            />
            <div className={`page-domain-status page-domain-status-${statusTone}`} role="status">
              <strong>{pageDomainStatusLabel(draft.domainStatus)}</strong>
              <span>SSL: {draft.sslStatus === 'active' ? '적용 완료' : draft.sslStatus === 'failed' ? '발급 실패' : '발급 대기'}</span>
            </div>
            {issues.length > 0 && <p className="settings-inline-error">{issues[0]}</p>}
            {draft.domainFailureReason && <p className="settings-inline-error">{draft.domainFailureReason}</p>}
            <div className="page-domain-dns-guide">
              <strong>DNS 연결</strong>
              {dns?.configured ? (
                <p><code>{dns.type}</code> 레코드로 <code>{dns.host}</code>를 <code>{dns.target}</code>에 연결하세요.</p>
              ) : (
                <p>도메인을 저장하면 운영 연결값과 확인 상태가 표시됩니다.</p>
              )}
            </div>
          </>
        )}

        {disabled && <p className="settings-inline-note">소유자 계정만 도메인을 변경할 수 있습니다.</p>}
        {saving && <p className="settings-inline-note">도메인 중복 확인 후 저장 중입니다.</p>}
      </div>
    </SettingsSection>
  );
}
