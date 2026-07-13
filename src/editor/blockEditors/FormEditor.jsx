import { useState } from 'react';
import './FormEditor.css';
import { EditorTabs } from '../ui/index.js';
import FormBasicSection from './FormBasicSection.jsx';
import FormDesignSection from './FormDesignSection.jsx';
import FormExternalSection from './FormExternalSection.jsx';
import FormFieldsSection from './FormFieldsSection.jsx';
import FormSubmissionSection from './FormSubmissionSection.jsx';
import { useFormQuestions } from './useFormQuestions.js';

export default function FormEditor({ s, set, page, blockId, generateStandaloneFormHtml }) {
  const questions = Array.isArray(s.questions) ? s.questions : [];
  const [htmlOpen, setHtmlOpen] = useState(false);
  const questionState = useFormQuestions({ questions, set });

  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '기본',
          content: <FormBasicSection s={s} set={set} />,
        },
        {
          id: 'items',
          label: '입력 항목',
          content: (
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
          ),
        },
        {
          id: 'submit',
          label: '제출',
          content: (
            <>
              <FormSubmissionSection s={s} set={set} />
              <FormExternalSection
                s={s}
                page={page}
                blockId={blockId}
                htmlOpen={htmlOpen}
                setHtmlOpen={setHtmlOpen}
                generateStandaloneFormHtml={generateStandaloneFormHtml}
              />
            </>
          ),
        },
        {
          id: 'style',
          label: '스타일',
          content: <FormDesignSection s={s} set={set} />,
        },
      ]}
    />
  );
}
