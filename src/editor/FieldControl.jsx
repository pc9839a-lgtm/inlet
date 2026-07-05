export function Field({ label, value, onChange, textarea, type = 'text', prefix = '', placeholder = '', disabled = false }) {
  const labelText = String(label || '');
  const kind = /제목|문구|상호명|로고|메뉴명|버튼/.test(labelText)
    ? 'title'
    : /설명|내용|주소|URL|메시지|코드|문의/.test(labelText)
      ? 'content'
      : 'option';

  return (
    <label className={`field field-${kind}`}>
      <span>{label}</span>
      <div className={prefix ? 'prefix-field' : ''}>
        {prefix && <em>{prefix}</em>}
        {textarea
          ? <textarea value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
          : <input type={type} value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
      </div>
    </label>
  );
}