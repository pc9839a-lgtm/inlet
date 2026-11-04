import './CodeEditor.css';
import { ChevronDown } from 'lucide-react';
import { EditorField } from '../ui/index.js';
import { CodeStylePanel } from './WidgetStylePanels.jsx';
import CodeEditorBox from './CodeEditorBox.jsx';
import CodeEditorModal from './CodeEditorModal.jsx';
import { useCodeDraft } from './useCodeDraft.js';

export default function CodeEditor({ s, set, blockId, codeDraftForBlock, onCodeDraftChange, clearCodeDraft }) {
  const stagedDraft = codeDraftForBlock?.(blockId, s.html || '');
  const { draft, setDraft, modalOpen, setModalOpen } = useCodeDraft(
    s.html, stagedDraft, onCodeDraftChange ? (value) => onCodeDraftChange(blockId, value) : undefined,
  );

  // 과거 저장된 BGM 프리셋은 편집 기능을 노출하지 않는다.
  if (s.widgetMode === 'bgm') return null;

  const codePending = draft !== (s.html || '');
  const codeDraftHint = codePending
    ? '코드 미적용'
    : '적용됨';

  const apply = () => {
    set({ html: draft, css: '', js: '', runJs: false });
    clearCodeDraft?.(blockId);
    setModalOpen(false);
  };

  return (
    <>
      <CodeEditorBox draft={draft} onDraftChange={setDraft} onOpenModal={() => setModalOpen(true)} onApply={apply} codePending={codePending} codeDraftHint={codeDraftHint} />
      <EditorField label="목록 구분 이름">
        <input
          type="text"
          aria-label="구분 이름"
          value={s.editorLabel || ''}
          maxLength={40}
          placeholder="예: 축하 영상, 찾아오시는 길"
          onChange={(event) => set({ editorLabel: event.target.value.slice(0, 40) })}
        />
      </EditorField>
      <details className="code-editor-options">
        <summary>영역 높이<ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="code-editor-options-body">
          <CodeStylePanel s={s} set={set} />
        </div>
      </details>
      {modalOpen && <CodeEditorModal draft={draft} onDraftChange={setDraft} onClose={() => setModalOpen(false)} onApply={apply} codePending={codePending} codeDraftHint={codeDraftHint} />}
    </>
  );
}
