import { Step } from '../controls.jsx';

export default function HeroBasicSection({ s, set, RichField }) {
  return (
    <Step title="기본" icon="1" open>
      <RichField label="제목" value={s.title} onChange={(v) => set({ title: v })} />
      <RichField label="설명" value={s.body} onChange={(v) => set({ body: v })} />
    </Step>
  );
}
