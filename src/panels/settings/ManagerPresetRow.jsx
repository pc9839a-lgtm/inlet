import { MANAGER_ACCESS_PRESETS } from './managerSettingsModel.js';

export default function ManagerPresetRow({ disabledManager, index, locked, setManagerPreset }) {
  return (
    <>
      <div className="manager-subtitle">{'\uBE60\uB978 \uAD8C\uD55C'}</div>
      <div className="manager-preset-row" aria-label="\uBE60\uB978 \uAD8C\uD55C \uC124\uC815">
        {MANAGER_ACCESS_PRESETS.map((preset) => (
          <button type="button" key={preset.id} disabled={locked || disabledManager} onClick={() => setManagerPreset(index, preset)}>
            {preset.label}
          </button>
        ))}
      </div>
    </>
  );
}
