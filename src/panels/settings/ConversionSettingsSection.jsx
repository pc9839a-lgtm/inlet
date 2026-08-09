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
    <SettingsSection id="conversion" className="settings-conversion-card">
      <div className="settings-stack settings-conversion-grid">
        <ConversionCodeFields
          conversionLocked={conversionLocked}
          hasConversionValue={hasConversionValue}
          page={page}
          saveConversionValues={saveConversionValues}
          setConversionLocked={setConversionLocked}
          updateConversionMeta={updateConversionMeta}
        />
        {showConversionToggles && (
          <section className="settings-surface settings-conversion-toggles">
            <header className="settings-surface-head simple">
              <div>
                <strong>전환 기록 방식</strong>
                <small>입력된 전환 코드에 맞춰 기록할 채널을 켜거나 끕니다.</small>
              </div>
            </header>
            <div className="settings-toggle-list">
              <ConversionToggleList
                conversionReady={conversionReady}
                integrations={integrations}
                updateIntegrations={updateIntegrations}
              />
            </div>
          </section>
        )}
      </div>
    </SettingsSection>
  );
}
