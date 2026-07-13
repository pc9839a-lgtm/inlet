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
      <EditorTabs
        tabs={[{
          id: 'code',
          label: '코드',
          content: <CodeEditorBox draft={draft} onDraftChange={setDraft} onOpenModal={() => setModalOpen(true)} onApply={apply} />,
        }]}
      />
      {modalOpen && <CodeEditorModal draft={draft} onDraftChange={setDraft} onClose={() => setModalOpen(false)} onApply={apply} />}
    </>
  );
}