import { useState } from 'react';
import { FileText, ListChecks, Share2 } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import FormBasicSection from './FormBasicSection.jsx';
import FormExternalSection from './FormExternalSection.jsx';
import FormFieldsSection from './FormFieldsSection.jsx';
import { useFormQuestions } from './useFormQuestions.js';

export default function FormEditor({ s, set, page, blockId, generateStandaloneFormHtml }) {
  const questions = Array.isArray(s.questions) ? s.questions : [];
  const [htmlOpen, setHtmlOpen] = useState(false);
  const questionState = useFormQuestions({ questions, set });

  return (
    <>
      <EditorSection id="content" title="내용" description="상담 폼의 제목과 제출 안내를 입력합니다." icon={FileText} defaultOpen>
        <FormBasicSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="items" title="입력 항목" description="방문자에게 받을 질문을 추가하고 순서를 정합니다." icon={ListChecks} defaultOpen>
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
      </EditorSection>
      <EditorSection id="behavior" title="공유 및 연동" description="외부 페이지에서 사용할 폼 코드를 확인합니다." icon={Share2}>
        <FormExternalSection
          s={s}
          page={page}
          blockId={blockId}
          htmlOpen={htmlOpen}
          setHtmlOpen={setHtmlOpen}
          generateStandaloneFormHtml={generateStandaloneFormHtml}
        />
      </EditorSection>
    </>
  );
}