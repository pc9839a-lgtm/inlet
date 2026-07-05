import { Danger, Field } from '../controls.jsx';

export default function FaqItemFields({ item, onChange, onRemove }) {
  return (
    <>
      <Field label="질문" value={item.q} onChange={(v) => onChange({ q: v })} />
      <Field label="답변" textarea value={item.a} onChange={(v) => onChange({ a: v })} />
      <Danger onClick={onRemove} />
    </>
  );
}