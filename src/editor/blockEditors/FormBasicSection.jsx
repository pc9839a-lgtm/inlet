import { Field, Step } from '../controls.jsx';
import RichField from '../RichField.jsx';
import { T } from './formEditorModel.js';
import FormPrivacySettings from './FormPrivacySettings.jsx';
import FormSuccessSettings from './FormSuccessSettings.jsx';

export default function FormBasicSection({ s, set }) {
  return (
    <Step title={T.basic} icon="1" open>
      <div className="form-basic-grid">
        <Field label={T.formTitle} value={s.title} onChange={(v) => set({ title: v })} />
        <Field label={T.submitText} value={s.submit} onChange={(v) => set({ submit: v })} />
      </div>
      <RichField label={T.guideText} value={s.desc} onChange={(v) => set({ desc: v })} />

      <div className="form-basic-subgrid compact-lines">
        <FormSuccessSettings s={s} set={set} />
        <FormPrivacySettings s={s} set={set} />
      </div>
    </Step>
  );
}