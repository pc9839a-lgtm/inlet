export function Toggle({ label, checked, onChange, disabled = false }) {
  const handleClick = (event) => {
    if (disabled) return;
    const keyboardActivation = event.detail === 0
      && document.activeElement === event.currentTarget;
    const ownerId = event.currentTarget.closest('[data-block-settings-id]')
      ?.getAttribute('data-block-settings-id');
    onChange(!checked);
    // A controlled draft update may remount a lazy Inspector. Restore focus
    // to the same labeled switch for successive Space key activation.
    if (keyboardActivation && ownerId) requestAnimationFrame(() => {
      const owner = [...document.querySelectorAll('[data-block-settings-id]')]
        .find((node) => node.getAttribute('data-block-settings-id') === ownerId);
      const replacement = [...(owner?.querySelectorAll('.toggle button[role="switch"]') || [])]
        .find((node) => node.getAttribute('aria-label') === label);
      replacement?.focus({ preventScroll: true });
    });
  };

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
        onClick={handleClick}
      >
        <i aria-hidden="true"></i>
      </button>
    </div>
  );
}
