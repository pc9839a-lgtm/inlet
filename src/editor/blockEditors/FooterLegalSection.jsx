import { Field, Step } from '../controls.jsx';

export default function FooterLegalSection({ s, set }) {
  return (
    <Step title="고급" icon="3">
      <Field label="개인정보처리방침" value={s.privacyUrl} onChange={(v) => set({ privacyUrl: v })} />
      <Field label="이용약관" value={s.termsUrl} onChange={(v) => set({ termsUrl: v })} />
    </Step>
  );
}