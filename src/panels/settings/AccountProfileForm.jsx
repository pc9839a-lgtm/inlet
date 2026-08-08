export default function AccountProfileForm({ email, onLogout, onSave, profileDraft, saving, setProfileField }) {
  return (
    <form className="account-settings-form account-profile-form-v2" onSubmit={onSave}>
      <div className="account-profile-fields">
        <label className="account-profile-field account-profile-name">
          <b className="account-profile-label">이름</b>
          <input
            value={profileDraft.name}
            onChange={(event) => setProfileField('name', event.target.value)}
            placeholder="이름"
          />
        </label>
        <label className="account-profile-field account-profile-email">
          <b className="account-profile-label">이메일</b>
          <input value={email} disabled placeholder="email@example.com" />
        </label>
        <label className="account-profile-field account-profile-phone">
          <b className="account-profile-label">연락처</b>
          <input
            type="tel"
            inputMode="tel"
            value={profileDraft.phone}
            onChange={(event) => setProfileField('phone', event.target.value)}
            placeholder="01012345678"
          />
        </label>
      </div>

      <div className="account-settings-actions account-profile-actions">
        <button type="submit" disabled={saving}>{saving ? '저장 중' : '계정 저장'}</button>
        <button type="button" onClick={onLogout}>로그아웃</button>
      </div>
    </form>
  );
}
