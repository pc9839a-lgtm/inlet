import AdvancedSettingsGroup from './AdvancedSettingsGroup.jsx';
import PageRevisionHistorySection from './PageRevisionHistorySection.jsx';
import ResetSettingsSection from './ResetSettingsSection.jsx';

export default function SettingsAdvancedAndReset({
  activeSection,
  authUser,
  canDuplicatePage,
  canResetProject = false,
  clientAdminMode,
  duplicateSettings,
  drafts,
  integrations,
  onReset,
  page,
  projectSettingsWritable,
  sections,
  setPage,
  updateIntegrations,
}) {
  if (clientAdminMode || !projectSettingsWritable) return null;

  const { openSection, setOpenSection } = sections;
  const {
    conversionLocked,
    conversionReady,
    editSection,
    hasConversionValue,
    lockedSections,
    saveConversionValues,
    saveSeo,
    saveTracking,
    seoDraft,
    setConversionLocked,
    setSeoDraft,
    setTrackingDraft,
    showConversionToggles,
    trackingDraft,
    updateConversionMeta,
  } = drafts;
  const { setDuplicateOpen } = duplicateSettings;

  return (
    <>
      {activeSection !== 'reset' && activeSection !== 'history' && (
        <AdvancedSettingsGroup
          activeSection={activeSection}
          canDuplicatePage={canDuplicatePage}
          conversionLocked={conversionLocked}
          conversionReady={conversionReady}
          editSection={editSection}
          hasConversionValue={hasConversionValue}
          integrations={integrations}
          lockedSections={lockedSections}
          openSection={openSection}
          page={page}
          saveConversionValues={saveConversionValues}
          saveSeo={saveSeo}
          saveTracking={saveTracking}
          seoDraft={seoDraft}
          setConversionLocked={setConversionLocked}
          setDuplicateOpen={setDuplicateOpen}
          setOpenSection={setOpenSection}
          setSeoDraft={setSeoDraft}
          setTrackingDraft={setTrackingDraft}
          showConversionToggles={showConversionToggles}
          trackingDraft={trackingDraft}
          updateConversionMeta={updateConversionMeta}
          updateIntegrations={updateIntegrations}
        />
      )}

      {activeSection === 'history' && (
        <PageRevisionHistorySection
          page={page}
          authUser={authUser}
          setPage={setPage}
        />
      )}

      {activeSection === 'reset' && canResetProject && (
        <ResetSettingsSection
          onReset={onReset}
          openSection={openSection}
          setOpenSection={setOpenSection}
        />
      )}
    </>
  );
}
