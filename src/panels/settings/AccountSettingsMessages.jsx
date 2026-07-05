export default function AccountSettingsMessages({ error, notice }) {
  return (
    <>
      {notice && <p className="account-settings-notice">{notice}</p>}
      {error && <p className="account-settings-error">{error}</p>}
    </>
  );
}
