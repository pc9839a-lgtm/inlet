import { Wrench } from 'lucide-react';
import { renderLazyEditor } from '../runtime/LazyRuntimeBoundary.jsx';
import { AnchorControl } from './AnchorControl.jsx';
import { BottomBarEditor, FooterEditor, TopNavEditor } from './blockEditorRegistry.jsx';
import TargetControl from './TargetControl.jsx';
import { BlockEditorShell, EditorSection } from './ui/index.js';

function renderFixedBlockEditor(Editor, block, props, updateBlock) {
  const set = (patch) => updateBlock(block.id, patch);

  return (
    <BlockEditorShell blockType={block.type}>
      {renderLazyEditor(Editor, { ...props, s: block.s || {}, set })}
      <EditorSection
        id="advanced"
        title="고급 설정"
        description="위젯 연결처럼 필요한 경우에만 사용하는 설정입니다."
        icon={Wrench}
      >
        <AnchorControl block={block} value={block.s?.anchorId || ''} set={set} />
      </EditorSection>
    </BlockEditorShell>
  );
}

export function createFixedBlockRenderers({ page, updateBlock }) {
  return {
    renderTopNavEditor: (block) => renderFixedBlockEditor(TopNavEditor, block, { page, TargetControl }, updateBlock),
    renderBottomBarEditor: (block) => renderFixedBlockEditor(BottomBarEditor, block, { page }, updateBlock),
    renderFooterEditor: (block) => renderFixedBlockEditor(FooterEditor, block, { page }, updateBlock),
  };
}