import { Field, Step } from '../controls.jsx';

export default function FaqBasicSection({ s, set }) {
  return (
    <Step title="기본" icon="1" open>
      <Field label="제목" value={s.title || '자주 묻는 질문'} onChange={(v) => set({ title: v })} />
    </Step>
  );
}