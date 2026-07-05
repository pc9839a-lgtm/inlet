import { Field, Step } from '../controls.jsx';
import { T } from './reservationEditorModel.js';

export default function ReservationBasicSection({ s, set }) {
  return (
    <Step title={T.basic} icon="1" open>
      <div className="reservation-basic-grid">
        <Field label={T.reservationTitle} value={s.title} onChange={(value) => set({ title: value })} />
        <Field label={T.successText} value={s.success || T.defaultSuccess} onChange={(value) => set({ success: value })} />
      </div>
      <Field label={T.guideText} value={s.desc} onChange={(value) => set({ desc: value })} textarea />
    </Step>
  );
}