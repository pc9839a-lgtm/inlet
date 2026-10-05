export function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <div className="toggle toggle-clean">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={checked ? 'active' : ''}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
      >
        <i aria-hidden="true"></i>
      </button>
    </div>
  );
}