import {
  authAccountErrorMessage,
  changeAuthPassword,
  confirmEmailVerification,
  isValidAccountPassword,
  normalizeAccountPhone,
  requestEmailVerification,
} from '../../lib/authAccounts.js';

export function createAccountSettingsActions({
  email,
  onAccountUpdate,
  passwordDraft,
  profileDraft,
  resetMessage,
  setChanging,
  setError,
  setNotice,
  setPasswordDraft,
  setSaving,
  setVerifying,
}) {
  const saveProfile = async (event) => {
    event.preventDefault();
    if (!onAccountUpdate) return;
    setSaving(true);
    resetMessage();
    try {
      await onAccountUpdate({
        name: profileDraft.name,
        phone: normalizeAccountPhone(profileDraft.phone),
      });
      setNotice('계정 정보를 저장했습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordCode = async () => {
    if (!email) {
      setError('계정 이메일을 확인할 수 없습니다.');
      return;
    }
    setVerifying(true);
    resetMessage();
    try {
      const verification = await requestEmailVerification(email, 'password-reset');
      setNotice(verification?.token ? '개발용 인증 코드: ' + verification.token : '인증 코드를 전송했습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!email) {
      setError('계정 이메일을 확인할 수 없습니다.');
      return;
    }
    if (!passwordDraft.code.trim()) {
      setError('인증 코드를 입력해주세요.');
      return;
    }
    if (!isValidAccountPassword(passwordDraft.password)) {
      setError('비밀번호는 영문과 숫자를 포함해 6자 이상 입력해주세요.');
      return;
    }
    if (passwordDraft.password !== passwordDraft.password2) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }
    setChanging(true);
    resetMessage();
    try {
      await confirmEmailVerification({ email, token: passwordDraft.code.trim() });
      await changeAuthPassword({ email, password: passwordDraft.password, token: passwordDraft.code.trim() });
      setPasswordDraft({ code: '', password: '', password2: '' });
      setNotice('비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setChanging(false);
    }
  };

  return { changePassword, saveProfile, sendPasswordCode };
}
