export default function SettingsActionBar({
  note = '',
  primaryLabel = '저장',
  primaryBusyLabel = '저장 중',
  primaryBusy = false,
  primaryDisabled = false,
  primaryType = 'button',
  onPrimary,
  secondaryLabel = '',
  secondaryDisabled = false,
  onSecondary,
  dangerLabel = '',
  dangerDisabled = false,
  onDanger,
}) {
  return (
    <footer className="settings-action-bar">
      <span className="settings-action-bar-note">{note}</span>
      <div className="settings-action-bar-buttons">
        {dangerLabel && (
          <button type="button" className="settings-danger-button" disabled={dangerDisabled} onClick={onDanger}>{dangerLabel}</button>
        )}
        {secondaryLabel && (
          <button type="button" className="settings-secondary-button" disabled={secondaryDisabled} onClick={onSecondary}>{secondaryLabel}</button>
        )}
        {onPrimary && (
          <button
            type={primaryType}
            className="settings-primary-button"
            disabled={primaryDisabled || primaryBusy}
            onClick={primaryType === 'submit' ? undefined : onPrimary}
          >
            {primaryBusy ? primaryBusyLabel : primaryLabel}
          </button>
        )}
      </div>
    </footer>
  );
}
