import { useId } from 'react';

export default function SettingsField({
  label,
  value = '',
  onChange = () => {},
  hint = '',
  error = '',
  type = 'text',
  textarea = false,
  rows,
  controlStyle,
  prefix = '',
  placeholder = '',
  disabled = false,
  readOnly = false,
  name,
  autoComplete,
  inputMode,
  className = '',
}) {
  const generatedId = useId();
  const controlId = name || `settings-field-${generatedId}`;
  const helpId = hint ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const controlProps = {
    id: controlId,
    value: value ?? '',
    disabled,
    readOnly,
    placeholder,
    name,
    autoComplete,
    inputMode,
    style: controlStyle,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    'aria-errormessage': errorId,
    onChange: (event) => onChange(event.target.value),
  };

  const control = textarea
    ? <textarea {...controlProps} rows={rows} />
    : <input {...controlProps} type={type} />;

  return (
    <div className={`settings-field-with-help ${className}`.trim()}>
      <label className="settings-control-group" htmlFor={controlId}>
        <span>{label}</span>
        {prefix ? (
          <div className="prefix-field">
            <em aria-hidden="true">{prefix}</em>
            {control}
          </div>
        ) : control}
      </label>
      {error ? (
        <small id={errorId} className="settings-field-error" role="alert">{error}</small>
      ) : hint ? (
        <small id={helpId} className="settings-field-help">{hint}</small>
      ) : null}
    </div>
  );
}
