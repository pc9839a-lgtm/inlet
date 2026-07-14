import { AnchorControl } from './AnchorControl.jsx';
import { LazyEditorBoundary } from './LazyEditorBoundary.jsx';
import { BlockEditorShell } from './ui/index.js';

export default function BlockEditor({ block, page, updateBlock, editors, editorDeps = {} }) {
  const s = block.s || {};
  const set = (patch) => updateBlock(block.id, patch);
  const Editor = editors?.[block.type];

  if (!Editor) return null;

  const props = { s, set, page, blockId: block.id, blockType: block.type, ...editorDeps };
  if (block.type === 'image') props.block = block;

  return (
    <BlockEditorShell blockType={block.type}>
      <AnchorControl block={block} value={s.anchorId || ''} set={set} />
      <LazyEditorBoundary resetKey={`${block.id}:${block.type}`}>
        <Editor {...props} />
      </LazyEditorBoundary>
    </BlockEditorShell>
  );
}
