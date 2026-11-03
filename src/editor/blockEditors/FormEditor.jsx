import { useState } from 'react';
import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import './FormEditor.css';
import { Field } from '../controls.jsx';
import FormBasicSection from './FormBasicSection.jsx';
import FormDesignSection from './FormDesignSection.jsx';
import FormExternalSection from './FormExternalSection.jsx';
import FormFieldsSection from './FormFieldsSection.jsx';
import FormSubmissionSection from './FormSubmissionSection.jsx';
import FormPrivacySettings from './FormPrivacySettings.jsx';
import FormSuccessSettings from './FormSuccessSettings.jsx';
import { useFormQuestions } from './useFormQuestions.js';

export default function FormEditor({ s, set, page, blockId, generateStandaloneFormHtml }) {
  const questions = Array.isArray(s.questions) ? s.questions : [];
  const [htmlOpen, setHtmlOpen] = useState(false);
  const questionState = useFormQuestions({ questions, set });

  return (
    <div className="form-editor-flow">
      <FormBasicSection s={s} set={set} />
      <FormFieldsSection
        questions={questions}
        openQuestionId={questionState.openQuestionId}
        dragQuestionId={questionState.dragQuestionId}
        dragOverQuestionId={questionState.dragOverQuestionId}
        onAdd={questionState.addQuestion}
        onUpdate={questionState.updateQuestion}
        onRemove={questionState.removeQuestion}
        onDuplicate={questionState.duplicateQuestion}
        onMove={questionState.moveQuestion}
        onToggleOpen={questionState.toggleQuestionOpen}
        onMoveByDrag={questionState.moveQuestionByDrag}
        onDragStart={questionState.startQuestionDrag}
        onDrop={questionState.dropQuestion}
        onDragEnd={questionState.endQuestionDrag}
      />
      <Field label="버튼 문구" value={s.submit} onChange={(value) => set({ submit: value })} />
      <div className="form-editor-settings">
        <h3 className="inspector-subgroup-heading">동작</h3>
        <FormPrivacySettings s={s} set={set} />
        <FormSuccessSettings s={s} set={set} />
        <FormSubmissionSection s={s} set={set} />
        <InspectorDisclosure label="디자인" className="form-basic-detail form-design-detail">
          <FormDesignSection s={s} set={set} direct />
        </InspectorDisclosure>
      </div>
      <FormExternalSection
        s={s}
        page={page}
        blockId={blockId}
        htmlOpen={htmlOpen}
        setHtmlOpen={setHtmlOpen}
        generateStandaloneFormHtml={generateStandaloneFormHtml}
      />
    </div>
  );
}
