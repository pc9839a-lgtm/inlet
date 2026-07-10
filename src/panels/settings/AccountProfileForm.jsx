export default function AccountProfileForm({ email, onLogout, onSave, profileDraft, saving, setProfileField }) {
  return (
    <form className="account-settings-form" onSubmit={onSave}>
      <div className="account-settings-grid">
        <label>
          <span>이름</span>
          <input value={profileDraft.name} onChange={(event) => setProfileField('name', event.target.value)} placeholder="이름" />
        </label>
        <label>
          <span>이메일</span>
          <input value={email} disabled placeholder="email@example.com" />
        </label>
        <label>
          <span>연락처</span>
          <input type="tel" inputMode="tel" value={profileDraft.phone} onChange={(event) => setProfileField('phone', event.target.value)} placeholder="01012345678" />
        </label>
        <div className="account-settings-actions">
          <button type="submit" disabled={saving}>{saving ? '저장 중' : '계정 저장'}</button>
          <button type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
    </form>
  );
}
