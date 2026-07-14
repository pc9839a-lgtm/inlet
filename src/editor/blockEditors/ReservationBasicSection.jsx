import { EditorField } from '../ui/index.js';
import { T } from './reservationEditorModel.js';

export default function ReservationBasicSection({ s, set }) {
  return (
    <>
      <div className="reservation-basic-grid">
        <EditorField label={T.reservationTitle}>
          <input value={s.title || ''} onChange={(event) => set({ title: event.target.value })} />
        </EditorField>
        <EditorField label={T.successText}>
          <input value={s.success || T.defaultSuccess} onChange={(event) => set({ success: event.target.value })} />
        </EditorField>
      </div>
      <EditorField label={T.guideText}>
        <textarea value={s.desc || ''} onChange={(event) => set({ desc: event.target.value })} />
      </EditorField>
    </>
  );
}