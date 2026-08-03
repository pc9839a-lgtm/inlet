import AccountSettingsSection from './AccountSettingsSection.jsx';
import PageBasicSettingsSection from './PageBasicSettingsSection.jsx';
import PageDomainSettingsSection from './PageDomainSettingsSection.jsx';
import SettingsManagerAccessSection from './SettingsManagerAccessSection.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function SettingsPrimarySections({
  authUser,
  canManageProjectUsers,
  clientAdminMode,
  domainSettings,
  drafts,
  managerSettings,
  onAccountUpdate,
  onLogout,
  ownership,
  sections,
  transferRequest,
}) {
  const { openSection, setOpenSection } = sections;
  const { basicDraft, editSection, lockedSections, saveBasic, setBasicDraft } = drafts;

  return (
    <>
      <SettingsSection id="account" title="계정 정보" description="프로필과 비밀번호 관리" openSection={openSection} setOpenSection={setOpenSection} className="account-settings-section">
        <AccountSettingsSection authUser={authUser} onAccountUpdate={onAccountUpdate} onLogout={onLogout} />
      </SettingsSection>

      <PageBasicSettingsSection
        authUser={authUser}
        basicDraft={basicDraft}
        clientAdminMode={clientAdminMode}
        locked={lockedSections.basic}
        onSave={saveBasic}
        onEdit={() => editSection('basic')}
        openSection={openSection}
        setBasicDraft={setBasicDraft}
        setOpenSection={setOpenSection}
      />

      <PageDomainSettingsSection
        domainSettings={domainSettings}
        openSection={openSection}
        setOpenSection={setOpenSection}
      />

      <SettingsManagerAccessSection
        authUser={authUser}
        canManageProjectUsers={canManageProjectUsers}
        locked={lockedSections.managers}
        managerSettings={managerSettings}
        openSection={openSection}
        ownership={ownership}
        setOpenSection={setOpenSection}
        transferRequest={transferRequest}
      />
    </>
  );
}
