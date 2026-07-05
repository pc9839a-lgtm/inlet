import { Field, Step } from '../controls.jsx';

export default function ImageCaptionSection({ s, set }) {
  return (
    <Step title="캡션" icon="3">
      <Field label="캡션" value={s.caption} onChange={(v) => set({ caption: v })} />
    </Step>
  );
}