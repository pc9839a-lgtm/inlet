import { FileText } from 'lucide-react';
import RichField from '../RichField.jsx';
import { EditorSection } from '../ui/index.js';

export default function TextEditor({ s, set }) {
  return (
    <EditorSection
      id="content"
      title="내용"
      description="방문자에게 보여줄 제목과 본문을 입력합니다."
      icon={FileText}
      defaultOpen
    >
      <RichField
        variant="v2"
        label="제목"
        description="이 화면에서 가장 먼저 읽히는 문구입니다."
        placeholder="제목을 입력하세요"
        value={s.title}
        onChange={(value) => set({ title: value })}
      />
      <RichField
        variant="v2"
        label="본문"
        description="제목을 보충하는 내용을 간결하게 작성합니다."
        placeholder="본문 내용을 입력하세요"
        value={s.body}
        onChange={(value) => set({ body: value })}
      />
    </EditorSection>
  );
}
