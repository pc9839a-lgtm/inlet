import './QuickDesignChoices.css';

// The cards operate exclusively on existing widget style fields. They never
// rewrite block content, create storage records or publish the page.
export default function QuickDesignChoices({
  kind, selected, choices, onSelect, title = '추천 디자인',
}) {
  const currentLabel = choices.find((choice) => choice.value === selected)?.label || '선택';
  return (
    <details className="editor-quick-design">
      <summary>
        <strong>{title === '추천 디자인' ? '디자인 변경' : title}</strong>
        <span className="editor-quick-design-current">{currentLabel}</span>
      </summary>
      <div className="editor-quick-design-options" role="group" aria-label={title}>
        {choices.map((choice, index) => (
          <button
            key={choice.value}
            type="button"
            className="editor-quick-design-option"
            aria-pressed={selected === choice.value}
            aria-label={`디자인 ${index + 1}: ${choice.label}`}
            onClick={() => onSelect(choice.value)}
            data-quick-design={`${kind}:${choice.value}`}
          >
            <span
              className="editor-quick-design-sample"
              data-kind={kind}
              data-look={choice.value}
              aria-hidden="true"
            >
              <span className="editor-quick-design-art" />
              <span className="editor-quick-design-lines">
                <span /><span /><span />
              </span>
              <span className="editor-quick-design-button" />
            </span>
            <span className="editor-quick-design-index">디자인 {index + 1}</span>
            <span className="editor-quick-design-label">{choice.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
