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
      setNotice('?? ??? ???????.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordCode = async () => {
    if (!email) {
      setError('?? ???? ??? ? ????.');
      return;
    }
    setVerifying(true);
    resetMessage();
    try {
      const verification = await requestEmailVerification(email, 'password-reset');
      setNotice(verification?.token ? '?? ??? ???: ' + verification.token : '?? ??? ?????.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!email) {
      setError('?? ???? ??? ? ????.');
      return;
    }
    if (!passwordDraft.code.trim()) {
      setError('?? ??? ?????.');
      return;
    }
    if (!isValidAccountPassword(passwordDraft.password)) {
      setError('????? ??? ??? ??? 6?? ????? ???.');
      return;
    }
    if (passwordDraft.password !== passwordDraft.password2) {
      setError('? ????? ?? ????.');
      return;
    }
    setChanging(true);
    resetMessage();
    try {
      await confirmEmailVerification({ email, token: passwordDraft.code.trim() });
      await changeAuthPassword({ email, password: passwordDraft.password, token: passwordDraft.code.trim() });
      setPasswordDraft({ code: '', password: '', password2: '' });
      setNotice('????? ???????. ?? ????? ? ????? ?????.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setChanging(false);
    }
  };

  return { changePassword, saveProfile, sendPasswordCode };
}
