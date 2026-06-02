function htmlToText(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  return doc.body.textContent || '';
}

function textToHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export default function RichField({ label, value, onChange }) {
  return (
    <label className="field rich-field-simple">
      <span>{label}</span>
      <textarea
        value={htmlToText(value)}
        onChange={(event) => onChange(textToHtml(event.target.value))}
      />
    </label>
  );
}
