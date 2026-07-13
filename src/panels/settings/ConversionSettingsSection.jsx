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
      title="전환 설정"
      description="접수와 예약 완료 기준"
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
