import './CodeEditor.css';
import { EditorTabs } from '../ui/index.js';
import { CodeStylePanel } from './WidgetStylePanels.jsx';
import CodeEditorBox from './CodeEditorBox.jsx';
import CodeEditorModal from './CodeEditorModal.jsx';
import { useCodeDraft } from './useCodeDraft.js';

export default function CodeEditor({ s, set }) {
  const { draft, setDraft, modalOpen, setModalOpen } = useCodeDraft(s.html);

  // 과거 저장된 BGM 프리셋은 편집 기능을 노출하지 않는다.
  if (s.widgetMode === 'bgm') return null;

  const apply = () => {
    set({ html: draft, css: '', js: '', runJs: false });
    setModalOpen(false);
  };

  return (
    <>
      <EditorTabs
        tabs={[
          {
            id: 'code',
            label: '코드',
            content: <CodeEditorBox draft={draft} onDraftChange={setDraft} onOpenModal={() => setModalOpen(true)} onApply={apply} />,
          },
          {
            id: 'style',
            label: '스타일',
            content: <CodeStylePanel s={s} set={set} />,
          },
        ]}
      />
      {modalOpen && <CodeEditorModal draft={draft} onDraftChange={setDraft} onClose={() => setModalOpen(false)} onApply={apply} />}
    </>
  );
}
