import AccountPasswordForm from './AccountPasswordForm.jsx';
import AccountProfileForm from './AccountProfileForm.jsx';
import AccountSettingsMessages from './AccountSettingsMessages.jsx';
import useAccountSettings from './useAccountSettings.js';

export default function AccountSettingsSection({ authUser, onAccountUpdate, onLogout }) {
  const account = useAccountSettings({ authUser, onAccountUpdate });

  if (!account.authUser) {
    return <p className="account-settings-empty">???? ??? ????.</p>;
  }

  return (
    <div className="account-settings-card">
      <AccountProfileForm
        email={account.email}
        onLogout={onLogout}
        onSave={account.saveProfile}
        profileDraft={account.profileDraft}
        saving={account.saving}
        setProfileField={account.setProfileField}
      />

      <AccountPasswordForm
        changing={account.changing}
        onChangePassword={account.changePassword}
        onSendCode={account.sendPasswordCode}
        passwordDraft={account.passwordDraft}
        setPasswordField={account.setPasswordField}
        verifying={account.verifying}
      />

      <AccountSettingsMessages error={account.error} notice={account.notice} />
    </div>
  );
}
