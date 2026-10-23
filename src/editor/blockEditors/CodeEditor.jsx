import './CodeEditor.css';
import { EditorTabs } from '../ui/index.js';
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
    ? '코드 미적용 · 적용 후 편집본에 반영됩니다. 공개는 발행 후입니다.'
    : '적용됨';

  const apply = () => {
    set({ html: draft, css: '', js: '', runJs: false });
    clearCodeDraft?.(blockId);
    setModalOpen(false);
  };

  return (
    <>
      <div className="anchor-control block-editor-anchor-control code-editor-name-control">
        <span className="block-editor-anchor-label">구분 이름</span>
        <div className="block-editor-anchor-value code-editor-name-value">
          <input
            type="text"
            value={s.editorLabel || ''}
            maxLength={40}
            placeholder="항목 이름"
            onChange={(event) => set({ editorLabel: event.target.value.slice(0, 40) })}
            aria-label="구분 이름"
          />
        </div>
      </div>

      <EditorTabs
        tabs={[
          {
            id: 'code',
            label: '코드',
            content: <CodeEditorBox draft={draft} onDraftChange={setDraft} onOpenModal={() => setModalOpen(true)} onApply={apply} codePending={codePending} codeDraftHint={codeDraftHint} />,
          },
          {
            id: 'style',
            label: '스타일',
            content: <CodeStylePanel s={s} set={set} />,
          },
        ]}
      />
      {modalOpen && <CodeEditorModal draft={draft} onDraftChange={setDraft} onClose={() => setModalOpen(false)} onApply={apply} codePending={codePending} codeDraftHint={codeDraftHint} />}
    </>
  );
}
