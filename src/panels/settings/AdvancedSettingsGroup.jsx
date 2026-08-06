import ConversionSettingsSection from './ConversionSettingsSection.jsx';
import PageDuplicateSettingsSection from './PageDuplicateSettingsSection.jsx';
import SeoSettingsSection from './SeoSettingsSection.jsx';
import TrackingSettingsSection from './TrackingSettingsSection.jsx';

export default function AdvancedSettingsGroup({
  activeSection,
  canDuplicatePage,
  conversionLocked,
  conversionReady,
  editSection,
  hasConversionValue,
  integrations,
  lockedSections,
  openSection,
  page,
  saveConversionValues,
  saveSeo,
  saveTracking,
  seoDraft,
  setConversionLocked,
  setDuplicateOpen,
  setOpenSection,
  setSeoDraft,
  setTrackingDraft,
  showConversionToggles,
  trackingDraft,
  updateConversionMeta,
  updateIntegrations,
}) {
  return (
    <>
      {activeSection === 'seo' && (
        <SeoSettingsSection
          locked={lockedSections.seo}
          onEdit={() => editSection('seo')}
          onSave={saveSeo}
          openSection={openSection}
          seoDraft={seoDraft}
          setOpenSection={setOpenSection}
          setSeoDraft={setSeoDraft}
        />
      )}

      {activeSection === 'tracking' && (
        <TrackingSettingsSection
          locked={lockedSections.tracking}
          onEdit={() => editSection('tracking')}
          onSave={saveTracking}
          openSection={openSection}
          setOpenSection={setOpenSection}
          setTrackingDraft={setTrackingDraft}
          trackingDraft={trackingDraft}
        />
      )}

      {activeSection === 'conversion' && (
        <ConversionSettingsSection
          conversionLocked={conversionLocked}
          conversionReady={conversionReady}
          hasConversionValue={hasConversionValue}
          integrations={integrations}
          openSection={openSection}
          page={page}
          saveConversionValues={saveConversionValues}
          setConversionLocked={setConversionLocked}
          setOpenSection={setOpenSection}
          showConversionToggles={showConversionToggles}
          updateConversionMeta={updateConversionMeta}
          updateIntegrations={updateIntegrations}
        />
      )}

      {activeSection === 'duplicate' && (
        <PageDuplicateSettingsSection
          canDuplicatePage={canDuplicatePage}
          openSection={openSection}
          setDuplicateOpen={setDuplicateOpen}
          setOpenSection={setOpenSection}
        />
      )}
    </>
  );
}
