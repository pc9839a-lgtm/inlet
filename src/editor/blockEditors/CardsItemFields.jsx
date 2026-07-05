import { Field } from '../controls.jsx';
import RichField from '../RichField.jsx';

export default function CardsItemFields({ item, onChange }) {
  return (
    <>
      <Field label="라벨" value={item.eyebrow || ''} onChange={(v) => onChange({ eyebrow: v })} />
      <RichField label="제목" value={item.title || ''} onChange={(v) => onChange({ title: v })} />
      <RichField label="내용" value={item.body || ''} onChange={(v) => onChange({ body: v })} />
    </>
  );
}