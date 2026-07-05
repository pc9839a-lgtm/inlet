import ConversionSettingsSection from './ConversionSettingsSection.jsx';
import PageDuplicateSettingsSection from './PageDuplicateSettingsSection.jsx';
import SeoSettingsSection from './SeoSettingsSection.jsx';
import TrackingSettingsSection from './TrackingSettingsSection.jsx';

export default function AdvancedSettingsGroup({
  advancedOpen,
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
  setAdvancedOpen,
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
      <div className={`settings-advanced-box ${advancedOpen ? 'open' : ''}`}>
        <button type="button" className="settings-advanced-head" aria-expanded={advancedOpen} aria-label={`고급 설정 ${advancedOpen ? '접기' : '열기'}`} onClick={() => setAdvancedOpen(!advancedOpen)}>
          <span>
            <strong>고급 설정</strong>
            <small>SEO · 추적 · 페이지 복제</small>
          </span>
          <em aria-hidden="true">{advancedOpen ? '접기' : '열기'}</em>
        </button>
      </div>

      {advancedOpen && (
        <div className="settings-advanced-list">
          <SeoSettingsSection
            locked={lockedSections.seo}
            onEdit={() => editSection('seo')}
            onSave={saveSeo}
            openSection={openSection}
            seoDraft={seoDraft}
            setOpenSection={setOpenSection}
            setSeoDraft={setSeoDraft}
          />

          <TrackingSettingsSection
            locked={lockedSections.tracking}
            onEdit={() => editSection('tracking')}
            onSave={saveTracking}
            openSection={openSection}
            setOpenSection={setOpenSection}
            setTrackingDraft={setTrackingDraft}
            trackingDraft={trackingDraft}
          />

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

          <PageDuplicateSettingsSection
            canDuplicatePage={canDuplicatePage}
            openSection={openSection}
            setDuplicateOpen={setDuplicateOpen}
            setOpenSection={setOpenSection}
          />
        </div>
      )}
    </>
  );
}
