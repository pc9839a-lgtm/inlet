export function SegmentedControl({ label, value, options = [], onChange, iconOnly = false }) {
  const singleRow = options.length > 0 && options.length <= 3;
  return (
    <div className="editor-segmented-v2" data-single-row={singleRow} role="group" aria-label={label}>
      <span className="editor-control-v2-copy">
        <strong>{label}</strong>
      </span>
      <div className="editor-segmented-v2-options" data-single-row={singleRow}>
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
          <button
            key={optionValue}
            type="button"
            aria-label={iconOnly && Icon ? optionLabel : undefined}
            title={iconOnly && Icon ? optionLabel : undefined}
            aria-pressed={String(value) === String(optionValue)}
            onClick={() => onChange(optionValue)}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {(!iconOnly || !Icon) && <span>{optionLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
