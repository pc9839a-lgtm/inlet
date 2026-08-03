import { useEffect, useState } from 'react';
import { createAccountSettingsActions } from './accountSettingsActions.js';

export default function useAccountSettings({ authUser, onAccountUpdate }) {
  const [profileDraft, setProfileDraft] = useState({ name: authUser?.name || '', phone: authUser?.phone || '' });
  const [emailDraft, setEmailDraft] = useState({ email: '', code: '', currentPassword: '' });
  const [passwordDraft, setPasswordDraft] = useState({ code: '', password: '', password2: '' });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [changing, setChanging] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailChanging, setEmailChanging] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const email = String(authUser?.email || '').trim().toLowerCase();

  useEffect(() => {
    setProfileDraft({ name: authUser?.name || '', phone: authUser?.phone || '' });
  }, [authUser?.name, authUser?.phone]);

  useEffect(() => {
    setEmailDraft({ email: '', code: '', currentPassword: '' });
  }, [authUser?.email]);

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

  const setEmailField = (key, value) => {
    resetMessage();
    setEmailDraft((draft) => ({ ...draft, [key]: value }));
  };

  const {
    changeEmail,
    changePassword,
    saveProfile,
    sendEmailChangeCode,
    sendPasswordCode,
  } = createAccountSettingsActions({
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
  });

  return {
    authUser,
    changing,
    changeEmail,
    changePassword,
    email,
    emailChanging,
    emailDraft,
    emailVerifying,
    error,
    notice,
    passwordDraft,
    profileDraft,
    saveProfile,
    saving,
    sendEmailChangeCode,
    sendPasswordCode,
    setEmailField,
    setPasswordField,
    setProfileField,
    verifying,
  };
}
