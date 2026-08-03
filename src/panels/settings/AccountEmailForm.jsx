export default function AccountEmailForm({
  changing,
  currentEmail,
  emailDraft,
  onChangeEmail,
  onSendCode,
  setEmailField,
  verifying,
}) {
  return (
    <form className="account-password-form" onSubmit={onChangeEmail}>
      <div className="account-password-head">
        <strong>이메일 변경</strong>
        <button type="button" disabled={verifying || !emailDraft.email.trim()} onClick={onSendCode}>
          {verifying ? '전송 중' : '새 이메일 인증'}
        </button>
      </div>
      <div className="account-settings-grid">
        <label>
          <span>현재 이메일</span>
          <input value={currentEmail} disabled aria-label="현재 이메일" />
        </label>
        <label>
          <span>새 이메일</span>
          <input
            name="pagero-new-email"
            type="email"
            autoComplete="email"
            value={emailDraft.email}
            onChange={(event) => setEmailField('email', event.target.value)}
            placeholder="new@example.com"
          />
        </label>
        <label>
          <span>인증 코드</span>
          <input
            name="pagero-email-change-code"
            autoComplete="one-time-code"
            inputMode="numeric"
            value={emailDraft.code}
            onChange={(event) => setEmailField('code', event.target.value)}
            placeholder="새 이메일로 받은 코드"
          />
        </label>
        <label>
          <span>현재 비밀번호</span>
          <input
            name="pagero-current-password"
            type="password"
            autoComplete="current-password"
            value={emailDraft.currentPassword}
            onChange={(event) => setEmailField('currentPassword', event.target.value)}
            placeholder="비밀번호 가입 계정만 입력"
          />
        </label>
        <div className="account-settings-actions">
          <button type="submit" disabled={changing}>{changing ? '변경 중' : '이메일 변경'}</button>
        </div>
      </div>
    </form>
  );
}
