export default function AccountProfileForm({ email, onLogout, onSave, profileDraft, saving, setProfileField }) {
  return (
    <form className="account-settings-form account-profile-form-v2" onSubmit={onSave}>
      <div className="account-profile-fields settings-form-grid">
        <label className="account-profile-field">
          <span className="account-profile-label">이름</span>
          <input
            value={profileDraft.name}
            onChange={(event) => setProfileField('name', event.target.value)}
            placeholder="이름"
            autoComplete="name"
          />
        </label>

        <label className="account-profile-field">
          <span className="account-profile-label">이메일</span>
          <input value={email} disabled placeholder="email@example.com" />
          <small className="settings-field-help">이메일 변경은 ‘이메일 변경’ 탭에서 할 수 있습니다.</small>
        </label>

        <label className="account-profile-field account-profile-phone">
          <span className="account-profile-label">연락처</span>
          <input
            type="tel"
            inputMode="tel"
            value={profileDraft.phone}
            onChange={(event) => setProfileField('phone', event.target.value)}
            placeholder="01012345678"
            autoComplete="tel"
          />
        </label>
      </div>

      <footer className="settings-action-bar account-profile-actions">
        <span className="settings-action-bar-note">계정 기본 정보를 관리합니다.</span>
        <div className="settings-action-bar-buttons">
          <button className="settings-secondary-button" type="button" onClick={onLogout}>로그아웃</button>
          <button className="settings-primary-button" type="submit" disabled={saving}>{saving ? '저장 중' : '계정 저장'}</button>
        </div>
      </footer>
    </form>
  );
}
