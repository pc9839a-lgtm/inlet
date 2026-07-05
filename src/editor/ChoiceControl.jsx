export function Choice({ label, value, onChange, options = [] }) {
  return (
    <div className="choice choice-clean" data-count={options.length}>
      <span>{label}</span>
      <div>
        {options.map(([optionValue, labelText]) => (
          <button
            key={optionValue}
            type="button"
            title={String(optionValue)}
            className={String(value) === String(optionValue) ? 'active' : ''}
            onClick={() => onChange(optionValue)}
          >
            {labelText}
          </button>
        ))}
      </div>
    </div>
  );
}