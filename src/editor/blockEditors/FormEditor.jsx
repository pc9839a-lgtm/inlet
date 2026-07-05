import { useState } from 'react';
import { EditorStack } from '../controls.jsx';
import FormBasicSection from './FormBasicSection.jsx';
import FormExternalSection from './FormExternalSection.jsx';
import FormFieldsSection from './FormFieldsSection.jsx';
import { useFormQuestions } from './useFormQuestions.js';

export default function FormEditor({ s, set, page, blockId, generateStandaloneFormHtml }) {
  const questions = Array.isArray(s.questions) ? s.questions : [];
  const [htmlOpen, setHtmlOpen] = useState(false);
  const questionState = useFormQuestions({ questions, set });

  return (
    <EditorStack>
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
      <FormExternalSection
        s={s}
        page={page}
        blockId={blockId}
        htmlOpen={htmlOpen}
        setHtmlOpen={setHtmlOpen}
        generateStandaloneFormHtml={generateStandaloneFormHtml}
      />
    </EditorStack>
  );
}