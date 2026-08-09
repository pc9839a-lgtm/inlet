import SettingsField from './SettingsField.jsx';

export default function ManagerProfileFields({ index, locked, manager, updateManager }) {
  return (
    <div className="settings-form-grid">
      <SettingsField
        label="이름"
        value={manager.name}
        disabled={locked}
        placeholder="매니저 이름"
        onChange={(value) => updateManager(index, { name: value })}
      />
      <SettingsField
        label="이메일"
        type="email"
        value={manager.email}
        disabled={locked}
        placeholder="manager@example.com"
        onChange={(value) => updateManager(index, { email: value.trim().toLowerCase() })}
      />
    </div>
  );
}
