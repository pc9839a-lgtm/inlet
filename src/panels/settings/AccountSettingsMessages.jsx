export default function AccountSettingsMessages({ error, notice }) {
  return (
    <div className="account-settings-messages" aria-live="polite">
      {notice && <p className="settings-message" role="status">{notice}</p>}
      {error && <p className="settings-message error" role="alert">{error}</p>}
    </div>
  );
}
