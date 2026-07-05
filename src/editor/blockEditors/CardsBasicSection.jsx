import { Step } from '../controls.jsx';
import RichField from '../RichField.jsx';

export default function CardsBasicSection({ title, desc, onChange }) {
  return (
    <Step title="기본" icon="1" open>
      <RichField label="제목" value={title} onChange={(v) => onChange({ title: v })} />
      <RichField label="설명" value={desc} onChange={(v) => onChange({ desc: v })} />
    </Step>
  );
}