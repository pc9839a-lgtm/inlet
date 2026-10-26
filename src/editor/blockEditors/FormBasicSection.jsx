import { Field } from '../controls.jsx';
import RichField from '../RichField.jsx';

export default function FormBasicSection({ s, set }) {
  return (
    <div className="form-basic-grid">
      <Field label="제목" value={s.title} onChange={(value) => set({ title: value })} />
      <RichField variant="v2" label="설명" value={s.desc} onChange={(value) => set({ desc: value })} />
    </div>
  );
}
