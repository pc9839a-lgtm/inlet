import { useEffect, useState } from 'react';
import { createAccountSettingsActions } from './accountSettingsActions.js';

export default function useAccountSettings({ authUser, onAccountUpdate }) {
  const [profileDraft, setProfileDraft] = useState({ name: authUser?.name || '', phone: authUser?.phone || '' });
  const [passwordDraft, setPasswordDraft] = useState({ code: '', password: '', password2: '' });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const email = String(authUser?.email || '').trim().toLowerCase();

  useEffect(() => {
    setProfileDraft({ name: authUser?.name || '', phone: authUser?.phone || '' });
  }, [authUser?.name, authUser?.phone]);

  const resetMessage = () => {
    setError('');
    setNotice('');
  };

  const setProfileField = (key, value) => {
    resetMessage();
    setProfileDraft((draft) => ({ ...draft, [key]: value }));
  };

  const setPasswordField = (key, value) => {
    resetMessage();
    setPasswordDraft((draft) => ({ ...draft, [key]: value }));
  };

  const { changePassword, saveProfile, sendPasswordCode } = createAccountSettingsActions({
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
  });

  return {
    authUser,
    changing,
    changePassword,
    email,
    error,
    notice,
    passwordDraft,
    profileDraft,
    saveProfile,
    saving,
    sendPasswordCode,
    setPasswordField,
    setProfileField,
    verifying,
  };
}
