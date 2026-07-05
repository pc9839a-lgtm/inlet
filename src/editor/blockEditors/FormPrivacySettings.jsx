import { Field, Toggle } from '../controls.jsx';
import { T } from './formEditorModel.js';

export default function FormPrivacySettings({ s, set }) {
  return (
    <details className="form-basic-detail form-inline-detail">
      <summary><strong>{T.privacy}</strong><span>{T.formBottom}</span></summary>
      <div className="privacy-compact-panel">
        <Toggle label={T.privacyRequired} checked={s.privacyRequired ?? true} onChange={(value) => set({ privacyRequired: value })} />
        <Field label={T.privacyText} textarea value={s.privacy} onChange={(v) => set({ privacy: v })} />
        <Field label={T.detailText} textarea value={s.privacyDetail || ''} onChange={(v) => set({ privacyDetail: v })} />
      </div>
    </details>
  );
}