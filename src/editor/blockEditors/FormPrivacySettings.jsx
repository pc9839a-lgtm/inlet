import { Field, Toggle } from '../controls.jsx';
import { T } from './formEditorModel.js';
import { ChevronDown } from 'lucide-react';

export default function FormPrivacySettings({ s, set, direct = false }) {
  const requirement = (s.privacyRequired ?? true) ? T.required : T.optional;
  const fields = (
    <div className="privacy-compact-panel">
      <Toggle label={T.privacyRequired} checked={s.privacyRequired ?? true} onChange={(value) => set({ privacyRequired: value })} />
      <Field label={T.privacyText} textarea value={s.privacy} onChange={(v) => set({ privacy: v })} />
      <Field label={T.detailText} textarea value={s.privacyDetail || ''} onChange={(v) => set({ privacyDetail: v })} />
    </div>
  );
  if (direct) {
    return (
      <section className="form-inline-group form-privacy-settings" aria-label={T.privacy}>
        <div className="form-inline-title"><h3>{T.privacy}</h3><span>{requirement}</span></div>
        {fields}
      </section>
    );
  }
  return (
    <details className="form-basic-detail form-inline-detail">
      <summary><strong>{T.privacy}</strong><span>{requirement}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      {fields}
    </details>
  );
}
