const CONVERSION_FIELDS = [
  {
    key: 'ads',
    label: 'Google Ads \uC804\uD658',
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
    label: 'Naver \uC804\uD658 ID',
    placeholder: 's_abcdef1234',
  },
  {
    key: 'kakao',
    label: 'Kakao Pixel ID',
    placeholder: '987654321',
  },
];

function ConversionCodeInput({ field, locked, page, updateConversionMeta }) {
  const value = page.meta?.[field.key] || '';
  const commonProps = {
    value,
    disabled: locked,
    onChange: (event) => updateConversionMeta({ [field.key]: event.target.value }),
    placeholder: field.placeholder,
  };

  return (
    <label className="settings-conversion-field">
      <span>{field.label}</span>
      {field.multiline ? <textarea {...commonProps} /> : <input {...commonProps} />}
    </label>
  );
}

export default function ConversionCodeFields({
  conversionLocked,
  hasConversionValue,
  page,
  saveConversionValues,
  setConversionLocked,
  updateConversionMeta,
}) {
  return (
    <div className="settings-full settings-conversion-values">
      {CONVERSION_FIELDS.map((field) => (
        <ConversionCodeInput
          key={field.key}
          field={field}
          locked={conversionLocked}
          page={page}
          updateConversionMeta={updateConversionMeta}
        />
      ))}
      <div className="settings-conversion-actions">
        {conversionLocked ? (
          <button type="button" className="test-connection-btn" onClick={() => setConversionLocked(false)}>
            {'\uC218\uC815'}
          </button>
        ) : (
          <button type="button" className="save-connection-btn" disabled={!hasConversionValue} onClick={saveConversionValues}>
            {'\uC800\uC7A5'}
          </button>
        )}
      </div>
    </div>
  );
}
