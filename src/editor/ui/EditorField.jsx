import { cloneElement, isValidElement, useId } from 'react';

export function EditorField({ label, required = false, error = '', children, className = '' }) {
  const generatedId = useId();
  const inputId = `editor-field-${generatedId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || inputId,
        'aria-describedby': children.props['aria-describedby'] || errorId,
        'aria-invalid': children.props['aria-invalid'] || Boolean(error),
      })
    : children;

  return (
    <label className={`editor-field-v2 ${error ? 'is-invalid' : ''} ${className}`.trim()} htmlFor={inputId}>
      <span className="editor-field-v2-label">
        <strong>{label}</strong>
        {required && <em>필수</em>}
      </span>
      <span className="editor-field-v2-control">{control}</span>
      {error && <small id={errorId} className="editor-field-v2-error">{error}</small>}
    </label>
  );
}
