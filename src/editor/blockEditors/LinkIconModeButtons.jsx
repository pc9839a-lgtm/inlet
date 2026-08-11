const ICON_MODES = [
  ['none', '없음'],
  ['emoji', '아이콘'],
  ['thumb', '썸네일'],
];

export default function LinkIconModeButtons({ mode, onChange }) {
  return (
    <div className="link-icon-mode-v2" role="group" aria-label="링크 아이콘">
      {ICON_MODES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={mode === key}
          className={mode === key ? 'active' : ''}
          onClick={() => onChange({ iconMode: key })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
