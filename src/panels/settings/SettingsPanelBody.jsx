import SettingsAdvancedAndReset from './SettingsAdvancedAndReset.jsx';
import PageDuplicateUrlModal from './PageDuplicateUrlModal.jsx';
import SettingsPanelHeader from './SettingsPanelHeader.jsx';
import SettingsPrimarySections from './SettingsPrimarySections.jsx';

export default function SettingsPanelBody({
  authUser,
  canDuplicatePage,
  canManageProjectUsers,
  clientAdminMode,
  domainSettings,
  duplicateSettings,
  drafts,
  integrations,
  managerSettings,
  onAccountUpdate,
  onLogout,
  onReset,
  ownership,
  page,
  sections,
  transferRequest,
  updateIntegrations,
}) {
  const {
    duplicateBlocked,
    duplicateDraft,
    duplicateIssues,
    duplicateOpen,
    requestPageDuplicate,
    setDuplicateField,
    setDuplicateOpen,
  } = duplicateSettings;

  return (
    <div className="simple-panel settings-panel">
      <SettingsPanelHeader page={page} />

      <SettingsPrimarySections
        authUser={authUser}
        canManageProjectUsers={canManageProjectUsers}
        clientAdminMode={clientAdminMode}
        domainSettings={domainSettings}
        drafts={drafts}
        managerSettings={managerSettings}
        onAccountUpdate={onAccountUpdate}
        onLogout={onLogout}
        ownership={ownership}
        sections={sections}
        transferRequest={transferRequest}
      />

      <SettingsAdvancedAndReset
        canDuplicatePage={canDuplicatePage}
        clientAdminMode={clientAdminMode}
        duplicateSettings={duplicateSettings}
        drafts={drafts}
        integrations={integrations}
        onReset={onReset}
        page={page}
        sections={sections}
        updateIntegrations={updateIntegrations}
      />

      {duplicateOpen && (
        <PageDuplicateUrlModal
          canDuplicatePage={canDuplicatePage}
          duplicateBlocked={duplicateBlocked}
          duplicateDraft={duplicateDraft}
          duplicateIssues={duplicateIssues}
          onClose={() => setDuplicateOpen(false)}
          onDuplicate={requestPageDuplicate}
          setDuplicateField={setDuplicateField}
        />
      )}
    </div>
  );
}