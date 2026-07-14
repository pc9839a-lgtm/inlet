import RichField from '../RichField.jsx';
import { EditorField } from '../ui/index.js';

export default function CardsItemFields({ item, onChange }) {
  return (
    <>
      <EditorField label="라벨">
        <input value={item.eyebrow || ''} onChange={(event) => onChange({ eyebrow: event.target.value })} />
      </EditorField>
      <RichField variant="v2" label="제목" value={item.title || ''} onChange={(value) => onChange({ title: value })} />
      <RichField variant="v2" label="내용" value={item.body || ''} onChange={(value) => onChange({ body: value })} />
    </>
  );
}