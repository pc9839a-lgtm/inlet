import '../lib/directVideoRuntime.js';
import './directVideoOverrides.css';
import { AnchorControl } from './AnchorControl.jsx';
import { LazyEditorBoundary } from './LazyEditorBoundary.jsx';
import { BlockEditorShell } from './ui/index.js';

export default function BlockEditor({ block, page, updateBlock, editors, editorDeps = {} }) {
  const s = block.s || {};
  const set = (patch) => updateBlock(block.id, patch);
  const editorType = ['youtube', 'video-file'].includes(s.widgetMode) ? 'youtube' : block.type;
  const Editor = editors?.[editorType];

  if (!Editor) return null;

  const props = { s, set, page, updateBlock, blockId: block.id, blockType: editorType, ...editorDeps };
  if (block.type === 'image') props.block = block;

  return (
    <BlockEditorShell blockType={editorType}>
      <LazyEditorBoundary resetKey={`${block.id}:${block.type}`}>
        <Editor {...props} />
      </LazyEditorBoundary>
      <details className="block-editor-advanced-settings">
        <summary>고급 설정 · 이동 앵커</summary>
        <p className="block-editor-advanced-description">버튼의 화면 이동 대상에 사용하는 주소입니다.</p>
        <AnchorControl block={block} value={s.anchorId || ''} set={set} />
      </details>
    </BlockEditorShell>
  );
}
