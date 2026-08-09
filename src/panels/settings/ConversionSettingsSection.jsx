import ConversionCodeFields from './ConversionCodeFields.jsx';
import ConversionToggleList from './ConversionToggleList.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function ConversionSettingsSection({
  conversionLocked,
  conversionReady,
  hasConversionValue,
  integrations,
  page,
  saveConversionValues,
  setConversionLocked,
  showConversionToggles,
  updateConversionMeta,
  updateIntegrations,
}) {
  return (
    <SettingsSection id="conversion" className="settings-conversion-card settings-flat-section">
      <ConversionCodeFields
        conversionLocked={conversionLocked}
        hasConversionValue={hasConversionValue}
        page={page}
        saveConversionValues={saveConversionValues}
        setConversionLocked={setConversionLocked}
        updateConversionMeta={updateConversionMeta}
      />
      {showConversionToggles && (
        <div className="settings-flat-block settings-conversion-toggles">
          <div className="settings-flat-block-head"><strong>기록 채널</strong></div>
          <div className="settings-toggle-list">
            <ConversionToggleList
              conversionReady={conversionReady}
              integrations={integrations}
              updateIntegrations={updateIntegrations}
            />
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
