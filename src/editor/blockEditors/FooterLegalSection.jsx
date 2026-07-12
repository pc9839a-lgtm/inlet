import { Field } from '../controls.jsx';

export default function FooterLegalSection({ s, set }) {
  return (
    <>
      <Field label="개인정보처리방침" value={s.privacyUrl} onChange={(value) => set({ privacyUrl: value })} />
      <Field label="이용약관" value={s.termsUrl} onChange={(value) => set({ termsUrl: value })} />
    </>
  );
}