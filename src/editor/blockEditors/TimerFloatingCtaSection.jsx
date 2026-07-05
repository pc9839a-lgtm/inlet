import { Field, Step, Toggle } from '../controls.jsx';
import { timerFloatLabel } from './timerEditorModel.js';

export default function TimerFloatingCtaSection({ s, set }) {
  return (
    <Step title="하단 CTA 연동" icon="2">
      <Toggle label="하단 CTA 표시" checked={!!s.floatOnBottom} onChange={(v) => set({ floatOnBottom: v })} />
      {s.floatOnBottom && <Field label="표시 문구" value={timerFloatLabel(s)} onChange={(v) => set({ floatLabel: v })} />}
    </Step>
  );
}
