import { Field } from '../controls.jsx';
import { T } from './formEditorModel.js';

export default function FormSuccessSettings({ s, set }) {
  return (
    <details className="form-basic-detail form-inline-detail">
      <summary><strong>{T.successMessage}</strong><span>{T.afterSubmit}</span></summary>
      <div className="form-one-line-panel">
        <Field label={T.title} value={s.successTitle || T.defaultSuccess} onChange={(v) => set({ successTitle: v })} />
        <Field label={T.body} textarea value={s.success} onChange={(v) => set({ success: v })} />
      </div>
    </details>
  );
}