import { Field } from '../controls.jsx';
import RichField from '../RichField.jsx';
import { T } from './formEditorModel.js';
import FormPrivacySettings from './FormPrivacySettings.jsx';
import FormSuccessSettings from './FormSuccessSettings.jsx';

export default function FormBasicSection({ s, set }) {
  return (
    <>
      <div className="form-basic-grid">
        <Field label={T.formTitle} value={s.title} onChange={(value) => set({ title: value })} />
        <Field label={T.submitText} value={s.submit} onChange={(value) => set({ submit: value })} />
      </div>
      <RichField variant="v2" label={T.guideText} description="입력 항목 위에 표시할 안내 문구입니다." value={s.desc} onChange={(value) => set({ desc: value })} />
      <div className="form-basic-subgrid compact-lines">
        <FormSuccessSettings s={s} set={set} />
        <FormPrivacySettings s={s} set={set} />
      </div>
    </>
  );
}