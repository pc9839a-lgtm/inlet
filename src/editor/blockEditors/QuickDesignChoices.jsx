import './QuickDesignChoices.css';

// The cards operate exclusively on existing widget style fields. They never
// rewrite block content, create storage records or publish the page.
export default function QuickDesignChoices({
  kind, selected, choices, onSelect, title = '추천 디자인',
}) {
  return (
    <section className="editor-quick-design" aria-label={title}>
      <div className="editor-quick-design-heading">
        <strong>{title}</strong>
        <span>누르면 미리보기에 바로 반영돼요</span>
      </div>
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
    </section>
  );
}
