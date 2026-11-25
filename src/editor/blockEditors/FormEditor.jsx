import { useState } from 'react';
import QuickDesignChoices from './QuickDesignChoices.jsx';
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
  // Keep only the currently expanded question across desktop/laptop editor
  // reparenting. This is session-local UI state, never page draft content.
  const questionState = useFormQuestions({
    questions, set,
    persistKey: blockId ? `${page?.id || 'draft'}:${blockId}` : '',
  });

  return (
    <div className="form-editor-flow editor-task-flow" data-editor-task="form">

      <section className="editor-task-section form-title-task" aria-label="폼 제목과 설명">
        <FormBasicSection s={s} set={set} />
      </section>
      <section className="editor-task-section form-questions-task" aria-label="받을 질문">
      <FormFieldsSection
        questions={questions}
        openQuestionId={questionState.openQuestionId}
        focusOnCreateQuestionId={questionState.newlyCreatedQuestionId}
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
      </section>
      <section className="editor-task-section form-submit-task" aria-label="제출 버튼 문구">
        <div className="editor-task-heading"><h3>제출 버튼</h3></div>
        <Field label="버튼 문구" value={s.submit} onChange={(value) => set({ submit: value })} />
      </section>


      <section className="editor-task-section editor-task-secondary" aria-label="추가 폼 설정">
      <InspectorDisclosure label="제출 안내와 개인정보" className="form-basic-detail form-outcome-detail" persistKey={blockId ? `${page?.id || 'draft'}:${blockId}:form-outcome` : ''}>
        <div className="form-editor-settings">
          <FormSuccessSettings s={s} set={set} direct />
          <FormPrivacySettings s={s} set={set} direct />
        </div>
      </InspectorDisclosure>
      <InspectorDisclosure label="디자인" className="form-basic-detail form-design-detail" persistKey={blockId ? `${page?.id || 'draft'}:${blockId}:form-design` : ''}>
<QuickDesignChoices
        kind="form"
        selected={s.style || 'card'}
        choices={[{ value: 'card', label: '기본 카드' }, { value: 'soft', label: '부드럽게' }, { value: 'minimal', label: '미니멀' }]}
        onSelect={(style) => set({
          style, inputStyle: style === 'minimal' ? 'underline' : style === 'card' ? 'box' : 'round',
          buttonStyle: style === 'soft' ? 'round' : 'solid',
          spacing: style === 'minimal' ? 'compact' : 'normal',
        })}
      />
        <FormDesignSection s={s} set={set} direct />
      </InspectorDisclosure>
      <InspectorDisclosure label="중복 접수와 외부 연동" className="form-behavior-detail" persistKey={blockId ? `${page?.id || 'draft'}:${blockId}:form-behavior` : ''}>
        <div className="form-editor-settings">
          <FormSubmissionSection s={s} set={set} direct />
        </div>
        <FormExternalSection
          s={s}
          page={page}
          blockId={blockId}
          htmlOpen={htmlOpen}
          setHtmlOpen={setHtmlOpen}
          generateStandaloneFormHtml={generateStandaloneFormHtml}
        />
      </InspectorDisclosure>
      </section>
    </div>
  );
}
