import { TARGET_LABELS } from './targetControlModel.js';

export function TargetModeTabs({ mode, onChange }) {
  return (
    <div className="target-mode-tabs">
      {[
        ['widget', TARGET_LABELS.widget],
        ['url', TARGET_LABELS.link],
      ].map(([key, text]) => (
        <button key={key} type="button" className={mode === key ? 'active' : ''} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}
