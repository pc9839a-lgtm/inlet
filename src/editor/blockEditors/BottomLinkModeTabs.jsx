export default function BottomLinkModeTabs({ mode, onChange }) {
  return (
    <div className="bottom-link-modes" role="group" aria-label="이동 방식">
      {[
        ['widget', '페이지 안에서'],
        ['url', '웹사이트'],
        ['phone', '전화 걸기'],
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
