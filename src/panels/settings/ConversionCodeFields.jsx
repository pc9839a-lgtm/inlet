import SettingsActionBar from './SettingsActionBar.jsx';
import SettingsField from './SettingsField.jsx';

const CONVERSION_FIELDS = [
  { key: 'ads', label: 'Google Ads', placeholder: 'AW-123456789/AbCdEf', multiline: true },
  { key: 'pixel', label: 'Meta Pixel', placeholder: '123456789012345' },
  { key: 'naver', label: 'Naver', placeholder: 's_abcdef1234' },
  { key: 'kakao', label: 'Kakao', placeholder: '987654321' },
];

export default function ConversionCodeFields({
  conversionLocked,
  hasConversionValue,
  page,
  saveConversionValues,
  setConversionLocked,
  updateConversionMeta,
}) {
  return (
    <div className="settings-flat-block settings-conversion-values">
      <div className="settings-flat-block-head"><strong>전환 코드</strong></div>
      <div className="settings-form-grid">
        {CONVERSION_FIELDS.map((field) => (
          <SettingsField
            key={field.key}
            label={field.label}
            textarea={field.multiline}
            value={page.meta?.[field.key] || ''}
            disabled={conversionLocked}
            placeholder={field.placeholder}
            onChange={(value) => updateConversionMeta({ [field.key]: value })}
          />
        ))}
      </div>
      <SettingsActionBar
        primaryLabel={conversionLocked ? '수정' : '저장'}
        primaryDisabled={!conversionLocked && !hasConversionValue}
        onPrimary={conversionLocked ? () => setConversionLocked(false) : saveConversionValues}
      />
    </div>
  );
}
