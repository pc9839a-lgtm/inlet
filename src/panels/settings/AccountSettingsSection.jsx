import { useState } from 'react';
import AccountEmailForm from './AccountEmailForm.jsx';
import AccountPasswordForm from './AccountPasswordForm.jsx';
import AccountProfileForm from './AccountProfileForm.jsx';
import AccountSettingsMessages from './AccountSettingsMessages.jsx';
import useAccountSettings from './useAccountSettings.js';

const ACCOUNT_TABS = [
  ['profile', '기본 정보'],
  ['email', '이메일 변경'],
  ['password', '비밀번호 변경'],
];

export default function AccountSettingsSection({ authUser, onAccountUpdate, onLogout }) {
  const account = useAccountSettings({ authUser, onAccountUpdate });
  const [activeTab, setActiveTab] = useState('profile');

  if (!account.authUser) {
    return <p className="account-settings-empty">로그인된 계정 정보가 없습니다.</p>;
  }

  return (
    <div className="account-settings-card account-settings-focused">
      <nav className="account-settings-tabs" aria-label="계정 설정 항목">
        {ACCOUNT_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'active' : ''}
            aria-pressed={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="account-settings-tab-panel">
        {activeTab === 'profile' && (
          <AccountProfileForm
            email={account.email}
            onLogout={onLogout}
            onSave={account.saveProfile}
            profileDraft={account.profileDraft}
            saving={account.saving}
            setProfileField={account.setProfileField}
          />
        )}

        {activeTab === 'email' && (
          <AccountEmailForm
            changing={account.emailChanging}
            currentEmail={account.email}
            emailDraft={account.emailDraft}
            onChangeEmail={account.changeEmail}
            onSendCode={account.sendEmailChangeCode}
            setEmailField={account.setEmailField}
            verifying={account.emailVerifying}
          />
        )}

        {activeTab === 'password' && (
          <AccountPasswordForm
            changing={account.changing}
            onChangePassword={account.changePassword}
            onSendCode={account.sendPasswordCode}
            passwordDraft={account.passwordDraft}
            setPasswordField={account.setPasswordField}
            verifying={account.verifying}
          />
        )}
      </div>

      <AccountSettingsMessages error={account.error} notice={account.notice} />
    </div>
  );
}
