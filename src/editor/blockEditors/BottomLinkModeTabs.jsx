export default function BottomLinkModeTabs({ mode, onChange }) {
  return (
    <div className="bottom-link-modes">
      {[
        ['widget', '위젯'],
        ['url', '링크'],
      ].map(([key, text]) => (
        <button
          key={key}
          type="button"
          className={mode === key ? 'active' : ''}
          aria-pressed={mode === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
