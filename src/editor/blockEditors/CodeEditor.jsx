import { Code2 } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import CodeEditorBox from './CodeEditorBox.jsx';
import CodeEditorModal from './CodeEditorModal.jsx';
import { useCodeDraft } from './useCodeDraft.js';

export default function CodeEditor({ s, set }) {
  const { draft, setDraft, modalOpen, setModalOpen } = useCodeDraft(s.html);

  const apply = () => {
    set({ html: draft, css: '', js: '', runJs: false, height: 'auto' });
    setModalOpen(false);
  };

  return (
    <>
      <EditorSection id="code" title="사용자 코드" description="코드는 페이지 표시와 보안에 영향을 줄 수 있습니다. 내용을 확인한 뒤 적용하세요." icon={Code2} tone="warning" defaultOpen>
        <CodeEditorBox draft={draft} onDraftChange={setDraft} onOpenModal={() => setModalOpen(true)} onApply={apply} />
      </EditorSection>
      {modalOpen && <CodeEditorModal draft={draft} onDraftChange={setDraft} onClose={() => setModalOpen(false)} onApply={apply} />}
    </>
  );
}