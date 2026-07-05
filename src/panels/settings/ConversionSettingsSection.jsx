import ConversionCodeFields from './ConversionCodeFields.jsx';
import ConversionToggleList from './ConversionToggleList.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function ConversionSettingsSection({
  conversionLocked,
  conversionReady,
  hasConversionValue,
  integrations,
  openSection,
  page,
  saveConversionValues,
  setConversionLocked,
  setOpenSection,
  showConversionToggles,
  updateConversionMeta,
  updateIntegrations,
}) {
  return (
    <SettingsSection
      id="conversion"
      title="\uC804\uD658 \uC124\uC815"
      description="\uC811\uC218\uC640 \uC608\uC57D \uC644\uB8CC \uAE30\uC900"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-conversion-card"
    >
      <div className="settings-conversion-grid">
        <ConversionCodeFields
          conversionLocked={conversionLocked}
          hasConversionValue={hasConversionValue}
          page={page}
          saveConversionValues={saveConversionValues}
          setConversionLocked={setConversionLocked}
          updateConversionMeta={updateConversionMeta}
        />
        {showConversionToggles && (
          <ConversionToggleList
            conversionReady={conversionReady}
            integrations={integrations}
            updateIntegrations={updateIntegrations}
          />
        )}
      </div>
    </SettingsSection>
  );
}
