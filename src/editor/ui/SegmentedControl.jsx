export function SegmentedControl({ label, value, options = [], onChange }) {
  return (
    <div className="editor-segmented-v2">
      <span className="editor-control-v2-copy">
        <strong>{label}</strong>
      </span>
      <div className="editor-segmented-v2-options">
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
          <button
            key={optionValue}
            type="button"
            aria-pressed={String(value) === String(optionValue)}
            onClick={() => onChange(optionValue)}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{optionLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
