const ICON_MODES = [
  ['none', '없음'],
  ['emoji', '아이콘'],
  ['thumb', '썸네일'],
];

export default function LinkIconModeButtons({ mode, onChange }) {
  return (
    <div className="link-icon-mode-v3" role="group" aria-label="링크 표시 방식">
      {ICON_MODES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={mode === key}
          onClick={() => onChange({ iconMode: key })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
