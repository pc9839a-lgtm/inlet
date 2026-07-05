import { Field, Step } from '../controls.jsx';

export default function FooterContactSection({ s, set }) {
  return (
    <Step title="추가 정보" icon="2">
      <Field label="이메일" value={s.email} onChange={(v) => set({ email: v })} />
      <Field label="주소" value={s.address} onChange={(v) => set({ address: v })} />
      <Field label="사업자번호" value={s.biz} onChange={(v) => set({ biz: v })} />
    </Step>
  );
}