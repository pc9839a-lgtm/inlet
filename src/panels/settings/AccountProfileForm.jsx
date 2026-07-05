export default function AccountProfileForm({ email, onLogout, onSave, profileDraft, saving, setProfileField }) {
  return (
    <form className="account-settings-form" onSubmit={onSave}>
      <div className="account-settings-grid">
        <label>
          <span>??</span>
          <input value={profileDraft.name} onChange={(event) => setProfileField('name', event.target.value)} placeholder="??" />
        </label>
        <label>
          <span>???</span>
          <input value={email} disabled placeholder="email@example.com" />
        </label>
        <label>
          <span>???</span>
          <input type="tel" inputMode="tel" value={profileDraft.phone} onChange={(event) => setProfileField('phone', event.target.value)} placeholder="01012345678" />
        </label>
        <div className="account-settings-actions">
          <button type="submit" disabled={saving}>{saving ? '?? ?' : '?? ??'}</button>
          <button type="button" onClick={onLogout}>????</button>
        </div>
      </div>
    </form>
  );
}
