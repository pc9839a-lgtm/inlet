import { Field } from '../controls.jsx';

export default function FooterBusinessSection({ s, set }) {
  return (
    <>
      <Field label="상호명" value={s.company} onChange={(value) => set({ company: value })} />
      <Field label="대표자" value={s.owner} onChange={(value) => set({ owner: value })} />
      <Field label="연락처" value={s.phone} onChange={(value) => set({ phone: value })} />
    </>
  );
}