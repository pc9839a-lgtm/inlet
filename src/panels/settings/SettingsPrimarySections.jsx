import AccountSettingsSection from './AccountSettingsSection.jsx';
import BillingSettingsSection from './BillingSettingsSection.jsx';
import CustomDomainSettingsSection from './CustomDomainSettingsSection.jsx';
import PageBasicSettingsSection from './PageBasicSettingsSection.jsx';
import ReferralSettingsSection from './ReferralSettingsSection.jsx';
import SettingsManagerAccessSection from './SettingsManagerAccessSection.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function SettingsPrimarySections({
  activeSection = 'account',
  authUser,
  canManageProjectUsers,
  clientAdminMode,
  drafts,
  integrations,
  managerSettings,
  onAccountUpdate,
  onLogout,
  ownership,
  sections,
  transferRequest,
  updateIntegrations,
}) {
  const { openSection, setOpenSection } = sections;
  const { basicDraft, editSection, lockedSections, saveBasic, setBasicDraft } = drafts;
  const ownerFinanceAccess = canManageProjectUsers && !clientAdminMode;

  return (
    <>
      {activeSection === 'account' && (
        <SettingsSection id="account" title="계정 정보" description="프로필과 비밀번호 관리" openSection={openSection} setOpenSection={setOpenSection} className="account-settings-section">
          <AccountSettingsSection authUser={authUser} onAccountUpdate={onAccountUpdate} onLogout={onLogout} />
        </SettingsSection>
      )}

      {activeSection === 'basic' && (
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
      )}

      {activeSection === 'domain' && (
        <CustomDomainSettingsSection
          integrations={integrations}
          openSection={openSection}
          setOpenSection={setOpenSection}
          updateIntegrations={updateIntegrations}
        />
      )}

      {activeSection === 'billing' && ownerFinanceAccess && (
        <BillingSettingsSection
          authUser={authUser}
          openSection={openSection}
          setOpenSection={setOpenSection}
        />
      )}

      {activeSection === 'referral' && ownerFinanceAccess && (
        <ReferralSettingsSection
          authUser={authUser}
          openSection={openSection}
          setOpenSection={setOpenSection}
        />
      )}

      {activeSection === 'managers' && canManageProjectUsers && (
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
      )}
    </>
  );
}
