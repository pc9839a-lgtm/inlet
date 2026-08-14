import { EditorField } from './ui/EditorField.jsx';

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  return doc.body.textContent || '';
}

function textToHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export default function RichField({ label, value, onChange, description = '', placeholder = '', required = false, variant = 'legacy' }) {
  if (variant === 'v2') {
    const compact = label === '제목';
    return (
      <EditorField
        label={label}
        description={description}
        required={required}
        className={compact ? 'editor-field-v2--compact-text' : 'editor-field-v2--body-text'}
      >
        <textarea
          rows={compact ? 2 : 3}
          value={htmlToText(value)}
          placeholder={placeholder}
          onChange={(event) => onChange(textToHtml(event.target.value))}
        />
      </EditorField>
    );
  }

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
