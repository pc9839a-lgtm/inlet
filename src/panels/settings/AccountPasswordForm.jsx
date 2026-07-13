export default function AccountPasswordForm({ changing, onChangePassword, onSendCode, passwordDraft, setPasswordField, verifying }) {
  return (
    <form className="account-password-form" onSubmit={onChangePassword}>
      <div className="account-password-head">
        <strong>비밀번호 변경</strong>
        <button type="button" disabled={verifying} onClick={onSendCode}>{verifying ? '전송 중' : '인증 코드 받기'}</button>
      </div>
      <div className="account-settings-grid">
        <label className="account-password-code">
          <span>인증 코드</span>
          <input name="pagero-password-code" autoComplete="one-time-code" inputMode="numeric" value={passwordDraft.code} onChange={(event) => setPasswordField('code', event.target.value)} placeholder="이메일로 받은 코드" />
        </label>
        <label className="account-password-new">
          <span>새 비밀번호</span>
          <input name="pagero-new-password" type="password" autoComplete="new-password" value={passwordDraft.password} onChange={(event) => setPasswordField('password', event.target.value)} placeholder="영문과 숫자 6자 이상" />
        </label>
        <label className="account-password-confirm">
          <span>새 비밀번호 확인</span>
          <input name="pagero-new-password-confirm" type="password" autoComplete="new-password" value={passwordDraft.password2} onChange={(event) => setPasswordField('password2', event.target.value)} placeholder="비밀번호 다시 입력" />
        </label>
        <div className="account-settings-actions">
          <button type="submit" disabled={changing}>{changing ? '변경 중' : '비밀번호 변경'}</button>
        </div>
      </div>
    </form>
  );
}
