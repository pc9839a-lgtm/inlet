import './QuickDesignChoices.css';

// Existing style fields only. One compact choice row inside the block's
// existing "디자인" disclosure; no second accordion, cards or saved UI state.
export default function QuickDesignChoices({
  kind, selected, choices, onSelect, title = '모양 선택',
}) {
  return (
    <div className="editor-quick-design" role="group" aria-label={title}>
      <div className="editor-quick-design-options">
        {choices.map((choice, index) => (
          <button
            key={choice.value}
            type="button"
            className="editor-quick-design-option"
            aria-pressed={selected === choice.value}
            aria-label={`모양 ${index + 1}: ${choice.label}`}
            onClick={() => onSelect(choice.value)}
            data-quick-design={`${kind}:${choice.value}`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
