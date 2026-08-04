import { AUTH_KEY } from '../../config/storageKeys.js';
import {
  authAccountErrorMessage,
  changeAuthEmail,
  changeAuthPassword,
  confirmEmailVerification,
  isValidAccountPassword,
  normalizeAccountPhone,
  requestEmailVerification,
} from '../../lib/authAccounts.js';
import { normalizeAuthUser } from '../../lib/authIdentity.js';

function validEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function createAccountSettingsActions({
  authUser,
  email,
  emailDraft,
  onAccountUpdate,
  passwordDraft,
  profileDraft,
  resetMessage,
  setChanging,
  setEmailChanging,
  setEmailDraft,
  setEmailVerifying,
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
      await confirmEmailVerification({ email, token: passwordDraft.code.trim(), purpose: 'password-reset' });
      await changeAuthPassword({ email, password: passwordDraft.password, token: passwordDraft.code.trim() });
      setPasswordDraft({ code: '', password: '', password2: '' });
      setNotice('비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setChanging(false);
    }
  };

  const sendEmailChangeCode = async () => {
    const nextEmail = String(emailDraft.email || '').trim().toLowerCase();
    if (!validEmail(nextEmail)) {
      setError('변경할 이메일을 정확히 입력해주세요.');
      return;
    }
    if (nextEmail === email) {
      setError('현재 이메일과 다른 이메일을 입력해주세요.');
      return;
    }
    setEmailVerifying(true);
    resetMessage();
    try {
      const verification = await requestEmailVerification(nextEmail, 'email-change');
      setNotice(verification?.token ? '개발용 인증 코드: ' + verification.token : '새 이메일로 인증 코드를 전송했습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setEmailVerifying(false);
    }
  };

  const changeEmail = async (event) => {
    event.preventDefault();
    const nextEmail = String(emailDraft.email || '').trim().toLowerCase();
    if (!validEmail(nextEmail)) {
      setError('변경할 이메일을 정확히 입력해주세요.');
      return;
    }
    if (nextEmail === email) {
      setError('현재 이메일과 다른 이메일을 입력해주세요.');
      return;
    }
    if (!String(emailDraft.code || '').trim()) {
      setError('새 이메일로 받은 인증 코드를 입력해주세요.');
      return;
    }
    const session = String(authUser?.session || '').trim();
    if (!session) {
      setError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }

    setEmailChanging(true);
    resetMessage();
    try {
      const updated = await changeAuthEmail({
        email: nextEmail,
        currentPassword: emailDraft.currentPassword || '',
        token: String(emailDraft.code || '').trim(),
        session,
        projectId: authUser?.defaultProject?.projectId || '',
      });
      const normalized = normalizeAuthUser({
        ...authUser,
        ...updated,
        session: updated?.session || '',
        signedAt: new Date().toISOString(),
      });
      localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
      setEmailDraft({ email: '', code: '', currentPassword: '' });
      setNotice('이메일을 변경했습니다. 새 이메일 계정으로 다시 연결합니다.');
      window.setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setEmailChanging(false);
    }
  };

  return {
    changeEmail,
    changePassword,
    saveProfile,
    sendEmailChangeCode,
    sendPasswordCode,
  };
}
