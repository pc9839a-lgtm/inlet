import SettingsActionBar from './SettingsActionBar.jsx';
import SettingsField from './SettingsField.jsx';

const CONVERSION_FIELDS = [
  {
    key: 'ads',
    label: 'Google Ads 전환',
    placeholder: 'AW-123456789/AbCdEf',
    multiline: true,
  },
  {
    key: 'pixel',
    label: 'Meta Pixel ID',
    placeholder: '123456789012345',
  },
  {
    key: 'naver',
    label: 'Naver 전환 ID',
    placeholder: 's_abcdef1234',
  },
  {
    key: 'kakao',
    label: 'Kakao Pixel ID',
    placeholder: '987654321',
  },
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
    <section className="settings-surface settings-conversion-values">
      <header className="settings-surface-head simple">
        <div>
          <strong>전환 코드</strong>
          <small>광고 플랫폼에서 발급받은 전환 ID를 입력합니다.</small>
        </div>
      </header>
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
        note="사용하는 전환 플랫폼의 ID만 입력하면 됩니다."
        primaryLabel={conversionLocked ? '전환 코드 수정' : '전환 코드 저장'}
        primaryDisabled={!conversionLocked && !hasConversionValue}
        onPrimary={conversionLocked ? () => setConversionLocked(false) : saveConversionValues}
      />
    </section>
  );
}
