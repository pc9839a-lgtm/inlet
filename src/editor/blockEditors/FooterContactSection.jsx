import { Field } from '../controls.jsx';

export default function FooterContactSection({ s, set }) {
  return (
    <>
      <Field label="이메일" value={s.email} onChange={(value) => set({ email: value })} />
      <Field label="주소" value={s.address} onChange={(value) => set({ address: value })} />
      <Field label="사업자번호" value={s.biz} onChange={(value) => set({ biz: value })} />
    </>
  );
}