import SettingsActionBar from './SettingsActionBar.jsx';
import SettingsField from './SettingsField.jsx';

export default function AccountPasswordForm({ changing, onChangePassword, onSendCode, passwordDraft, setPasswordField, verifying }) {
  const mismatch = passwordDraft.password2 && passwordDraft.password !== passwordDraft.password2;

  return (
    <form className="account-password-form" onSubmit={onChangePassword}>
      <div className="settings-form-grid">
        <SettingsField
          label="인증 코드"
          name="pagero-password-code"
          autoComplete="one-time-code"
          inputMode="numeric"
          value={passwordDraft.code}
          onChange={(value) => setPasswordField('code', value)}
          placeholder="이메일로 받은 코드"
          hint="현재 계정 이메일로 발송된 코드를 입력하세요."
        />
        <div />
        <SettingsField
          label="새 비밀번호"
          name="pagero-new-password"
          type="password"
          autoComplete="new-password"
          value={passwordDraft.password}
          onChange={(value) => setPasswordField('password', value)}
          placeholder="영문과 숫자 6자 이상"
        />
        <SettingsField
          label="새 비밀번호 확인"
          name="pagero-new-password-confirm"
          type="password"
          autoComplete="new-password"
          value={passwordDraft.password2}
          onChange={(value) => setPasswordField('password2', value)}
          placeholder="비밀번호 다시 입력"
          error={mismatch ? '새 비밀번호가 서로 일치하지 않습니다.' : ''}
        />
      </div>

      <SettingsActionBar
        note={verifying ? '인증 코드를 전송하고 있습니다.' : '인증 코드를 받은 뒤 새 비밀번호를 저장하세요.'}
        secondaryLabel={verifying ? '전송 중' : '인증 코드 받기'}
        secondaryDisabled={verifying}
        onSecondary={onSendCode}
        primaryLabel="비밀번호 변경"
        primaryBusyLabel="변경 중"
        primaryBusy={changing}
        primaryDisabled={!passwordDraft.code.trim() || !passwordDraft.password || !passwordDraft.password2 || mismatch}
        primaryType="submit"
        onPrimary={onChangePassword}
      />
    </form>
  );
}
