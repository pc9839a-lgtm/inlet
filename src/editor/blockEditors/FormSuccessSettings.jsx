import { Field } from '../controls.jsx';
import { T } from './formEditorModel.js';
import { ChevronDown } from 'lucide-react';

export default function FormSuccessSettings({ s, set }) {
  return (
    <details className="form-basic-detail form-inline-detail">
      <summary><strong>접수 후 화면</strong><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="form-one-line-panel">
        <Field label={T.title} value={s.successTitle ?? T.defaultSuccess} onChange={(v) => set({ successTitle: v })} />
        <Field label={T.body} textarea value={s.success} onChange={(v) => set({ success: v })} />
      </div>
    </details>
  );
}
