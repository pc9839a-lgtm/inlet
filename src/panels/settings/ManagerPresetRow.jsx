import { MANAGER_ACCESS_PRESETS } from './managerSettingsModel.js';

function presetMatches(manager = {}, preset = {}) {
  const current = manager.access || {};
  const target = preset.access || {};
  return Object.keys(target).every((tab) => (
    Boolean(current?.[tab]?.read) === Boolean(target?.[tab]?.read)
    && Boolean(current?.[tab]?.write) === Boolean(target?.[tab]?.write)
  ));
}

export default function ManagerPresetRow({ disabledManager, index, locked, manager, setManagerPreset }) {
  return (
    <>
      <div className="manager-subtitle">역할</div>
      <div className="manager-preset-row" aria-label="매니저 역할 프리셋">
        {MANAGER_ACCESS_PRESETS.map((preset) => {
          const active = presetMatches(manager, preset);
          return (
            <button
              type="button"
              key={preset.id}
              className={active ? 'active' : ''}
              aria-pressed={active}
              disabled={locked || disabledManager}
              onClick={() => setManagerPreset(index, preset)}
              title={preset.description}
            >
              <strong>{preset.label}</strong>
            </button>
          );
        })}
      </div>
    </>
  );
}
