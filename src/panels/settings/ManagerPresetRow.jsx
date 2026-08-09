import { MANAGER_ACCESS_PRESETS } from './managerSettingsModel.js';

export default function ManagerPresetRow({ disabledManager, index, locked, setManagerPreset }) {
  return (
    <>
      <div className="manager-subtitle">역할 프리셋</div>
      <p className="manager-subcopy">먼저 기본 역할을 선택하고 필요한 경우 메뉴 권한을 세부 조정하세요.</p>
      <div className="manager-preset-row" aria-label="매니저 역할 프리셋">
        {MANAGER_ACCESS_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            disabled={locked || disabledManager}
            onClick={() => setManagerPreset(index, preset)}
            title={preset.description}
          >
            <strong>{preset.label}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
    </>
  );
}
