export default function SettingsField({
  label,
  value = '',
  onChange = () => {},
  hint = '',
  error = '',
  type = 'text',
  textarea = false,
  prefix = '',
  placeholder = '',
  disabled = false,
  readOnly = false,
  name,
  autoComplete,
  inputMode,
  className = '',
}) {
  const controlProps = {
    value: value ?? '',
    disabled,
    readOnly,
    placeholder,
    name,
    autoComplete,
    inputMode,
    'aria-invalid': error ? 'true' : undefined,
    onChange: (event) => onChange(event.target.value),
  };

  const control = textarea
    ? <textarea {...controlProps} />
    : <input {...controlProps} type={type} />;

  return (
    <div className={`settings-field-with-help ${className}`.trim()}>
      <label className="settings-control-group">
        <span>{label}</span>
        {prefix ? (
          <div className="prefix-field">
            <em aria-hidden="true">{prefix}</em>
            {control}
          </div>
        ) : control}
      </label>
      {error ? (
        <small className="settings-field-error" role="alert">{error}</small>
      ) : hint ? (
        <small className="settings-field-help">{hint}</small>
      ) : null}
    </div>
  );
}
