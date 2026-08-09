import SettingsActionBar from './SettingsActionBar.jsx';
import SettingsField from './SettingsField.jsx';

export default function AccountProfileForm({ email, onLogout, onSave, profileDraft, saving, setProfileField }) {
  return (
    <form className="account-settings-form account-profile-form-v2" onSubmit={onSave}>
      <div className="settings-form-grid">
        <SettingsField
          label="이름"
          value={profileDraft.name}
          onChange={(value) => setProfileField('name', value)}
          placeholder="이름"
          autoComplete="name"
        />
        <SettingsField
          label="이메일"
          value={email}
          disabled
          placeholder="email@example.com"
        />
        <SettingsField
          label="연락처"
          value={profileDraft.phone}
          onChange={(value) => setProfileField('phone', value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01012345678"
          className="settings-grid-span-2"
        />
      </div>

      <SettingsActionBar
        secondaryLabel="로그아웃"
        onSecondary={onLogout}
        primaryLabel="저장"
        primaryBusyLabel="저장 중"
        primaryBusy={saving}
        primaryType="submit"
        onPrimary={onSave}
      />
    </form>
  );
}
