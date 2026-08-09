import SettingsActionBar from './SettingsActionBar.jsx';
import SettingsField from './SettingsField.jsx';

export default function AccountEmailForm({
  changing,
  currentEmail,
  emailDraft,
  onChangeEmail,
  onSendCode,
  setEmailField,
  verifying,
}) {
  const emailReady = !!emailDraft.email.trim();

  return (
    <form className="account-password-form" onSubmit={onChangeEmail}>
      <div className="settings-form-grid">
        <SettingsField
          label="현재 이메일"
          value={currentEmail}
          disabled
          hint="현재 로그인 계정입니다."
        />
        <SettingsField
          label="새 이메일"
          name="pagero-new-email"
          type="email"
          autoComplete="email"
          value={emailDraft.email}
          onChange={(value) => setEmailField('email', value)}
          placeholder="new@example.com"
          hint="새 이메일로 인증 코드를 받은 뒤 변경할 수 있습니다."
        />
        <SettingsField
          label="인증 코드"
          name="pagero-email-change-code"
          autoComplete="one-time-code"
          inputMode="numeric"
          value={emailDraft.code}
          onChange={(value) => setEmailField('code', value)}
          placeholder="새 이메일로 받은 코드"
        />
        <SettingsField
          label="현재 비밀번호"
          name="pagero-current-password"
          type="password"
          autoComplete="current-password"
          value={emailDraft.currentPassword}
          onChange={(value) => setEmailField('currentPassword', value)}
          placeholder="비밀번호 가입 계정만 입력"
        />
      </div>

      <SettingsActionBar
        note={verifying ? '새 이메일로 인증 코드를 전송하고 있습니다.' : '먼저 새 이메일 인증 코드를 받아주세요.'}
        secondaryLabel={verifying ? '전송 중' : '인증 코드 받기'}
        secondaryDisabled={verifying || !emailReady}
        onSecondary={onSendCode}
        primaryLabel="이메일 변경"
        primaryBusyLabel="변경 중"
        primaryBusy={changing}
        primaryType="submit"
        primaryDisabled={!emailReady || !emailDraft.code.trim()}
        onPrimary={onChangeEmail}
      />
    </form>
  );
}
