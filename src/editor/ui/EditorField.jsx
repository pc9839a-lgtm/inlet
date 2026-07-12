import { cloneElement, isValidElement, useId } from 'react';

export function EditorField({ label, description = '', required = false, error = '', children, className = '' }) {
  const generatedId = useId();
  const inputId = `editor-field-${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || inputId,
        'aria-describedby': children.props['aria-describedby'] || describedBy,
        'aria-invalid': children.props['aria-invalid'] || Boolean(error),
      })
    : children;

  return (
    <label className={`editor-field-v2 ${error ? 'is-invalid' : ''} ${className}`.trim()} htmlFor={inputId}>
      <span className="editor-field-v2-label">
        <strong>{label}</strong>
        {required && <em>필수</em>}
      </span>
      {description && <small id={descriptionId} className="editor-field-v2-description">{description}</small>}
      <span className="editor-field-v2-control">{control}</span>
      {error && <small id={errorId} className="editor-field-v2-error">{error}</small>}
    </label>
  );
}
