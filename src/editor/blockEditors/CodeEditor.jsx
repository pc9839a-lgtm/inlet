import { EditorStack, Step } from '../controls.jsx';
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
    <EditorStack>
      <Step title="코드" icon="1" open>
        <CodeEditorBox
          draft={draft}
          onDraftChange={setDraft}
          onOpenModal={() => setModalOpen(true)}
          onApply={apply}
        />
      </Step>

      {modalOpen && (
        <CodeEditorModal
          draft={draft}
          onDraftChange={setDraft}
          onClose={() => setModalOpen(false)}
          onApply={apply}
        />
      )}
    </EditorStack>
  );
}