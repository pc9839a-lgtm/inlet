import { cloneElement, isValidElement, useId } from 'react';

export function EditorField({ label, required = false, error = '', children, className = '' }) {
  const generatedId = useId();
  const inputId = `editor-field-${generatedId}`;
  const controlId = isValidElement(children) && children.props.id ? children.props.id : inputId;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = isValidElement(children)
    ? [children.props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined
    : errorId;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-errormessage': errorId,
        'aria-invalid': children.props['aria-invalid'] || Boolean(error),
      })
    : children;

  return (
    <label className={`editor-field-v2 ${error ? 'is-invalid' : ''} ${className}`.trim()} htmlFor={controlId}>
      <span className="editor-field-v2-label">
        <strong>{label}</strong>
        {required && <em>필수</em>}
      </span>
      <span className="editor-field-v2-control">{control}</span>
      {error && <small id={errorId} className="editor-field-v2-error">{error}</small>}
    </label>
  );
}
