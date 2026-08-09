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
          placeholder="인증 코드"
        />
        <div />
        <SettingsField
          label="새 비밀번호"
          name="pagero-new-password"
          type="password"
          autoComplete="new-password"
          value={passwordDraft.password}
          onChange={(value) => setPasswordField('password', value)}
          placeholder="영문·숫자 6자 이상"
        />
        <SettingsField
          label="비밀번호 확인"
          name="pagero-new-password-confirm"
          type="password"
          autoComplete="new-password"
          value={passwordDraft.password2}
          onChange={(value) => setPasswordField('password2', value)}
          placeholder="다시 입력"
          error={mismatch ? '비밀번호가 일치하지 않습니다.' : ''}
        />
      </div>

      <SettingsActionBar
        secondaryLabel={verifying ? '전송 중' : '인증 코드 받기'}
        secondaryDisabled={verifying}
        onSecondary={onSendCode}
        primaryLabel="변경"
        primaryBusyLabel="변경 중"
        primaryBusy={changing}
        primaryDisabled={!passwordDraft.code.trim() || !passwordDraft.password || !passwordDraft.password2 || mismatch}
        primaryType="submit"
        onPrimary={onChangePassword}
      />
    </form>
  );
}
