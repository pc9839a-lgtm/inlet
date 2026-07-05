import AdvancedSettingsGroup from './AdvancedSettingsGroup.jsx';
import ResetSettingsSection from './ResetSettingsSection.jsx';

export default function SettingsAdvancedAndReset({
  canDuplicatePage,
  clientAdminMode,
  duplicateSettings,
  drafts,
  integrations,
  onReset,
  page,
  sections,
  updateIntegrations,
}) {
  if (clientAdminMode) return null;

  const { advancedOpen, openSection, setAdvancedOpen, setOpenSection } = sections;
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
      <AdvancedSettingsGroup
        advancedOpen={advancedOpen}
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
        setAdvancedOpen={setAdvancedOpen}
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

      <ResetSettingsSection
        onReset={onReset}
        openSection={openSection}
        setOpenSection={setOpenSection}
      />
    </>
  );
}