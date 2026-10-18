import { TARGET_LABELS } from './targetControlModel.js';

export function TargetModeTabs({ mode, onChange }) {
  return (
    <div className="target-mode-tabs" role="group" aria-label="이동 방식">
      {[
        ['widget', TARGET_LABELS.widget],
        ['url', TARGET_LABELS.link],
        ['phone', TARGET_LABELS.phone],
      ].map(([key, text]) => (
        <button key={key} type="button" className={mode === key ? 'active' : ''} aria-pressed={mode === key} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}
