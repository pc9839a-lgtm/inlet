import { Field, Step } from '../controls.jsx';

export default function FooterBusinessSection({ s, set }) {
  return (
    <Step title="기본" icon="1" open>
      <Field label="상호명" value={s.company} onChange={(v) => set({ company: v })} />
      <Field label="대표자" value={s.owner} onChange={(v) => set({ owner: v })} />
      <Field label="연락처" value={s.phone} onChange={(v) => set({ phone: v })} />
    </Step>
  );
}