import { EditorField } from '../ui/index.js';

export default function FaqItemFields({ item, onChange }) {
  return (
    <>
      <EditorField label="질문">
        <input value={item.q || ''} onChange={(event) => onChange({ q: event.target.value })} />
      </EditorField>
      <EditorField label="답변">
        <textarea value={item.a || ''} onChange={(event) => onChange({ a: event.target.value })} />
      </EditorField>
    </>
  );
}