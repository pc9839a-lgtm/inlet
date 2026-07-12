import { Wrench } from 'lucide-react';
import { AnchorControl } from './AnchorControl.jsx';
import { LazyEditorBoundary } from './LazyEditorBoundary.jsx';
import { BlockEditorShell, EditorSection } from './ui/index.js';

export default function BlockEditor({ block, page, updateBlock, editors, editorDeps = {} }) {
  const s = block.s || {};
  const set = (patch) => updateBlock(block.id, patch);
  const Editor = editors?.[block.type];

  if (!Editor) return null;

  const props = { s, set, page, blockId: block.id, blockType: block.type, ...editorDeps };
  if (block.type === 'image') props.block = block;

  return (
    <BlockEditorShell blockType={block.type}>
      <LazyEditorBoundary resetKey={`${block.id}:${block.type}`}>
        <Editor {...props} />
      </LazyEditorBoundary>
      <EditorSection
        id="advanced"
        title="고급 설정"
        description="위젯 연결처럼 필요한 경우에만 사용하는 설정입니다."
        icon={Wrench}
      >
        <AnchorControl block={block} value={s.anchorId || ''} set={set} />
      </EditorSection>
    </BlockEditorShell>
  );
}
