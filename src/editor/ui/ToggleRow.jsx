export function ToggleRow({ label, description = '', checked, disabled = false, onChange }) {
  return (
    <div className={`editor-toggle-row-v2 ${disabled ? 'is-disabled' : ''}`}>
      <span className="editor-control-v2-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
