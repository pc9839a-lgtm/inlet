import { renderLazyEditor } from '../runtime/LazyRuntimeBoundary.jsx';
import { AnchorControl } from './AnchorControl.jsx';
import { BottomBarEditor, FooterEditor, TopNavEditor } from './blockEditorRegistry.jsx';
import TargetControl from './TargetControl.jsx';
import { BlockEditorShell } from './ui/index.js';

function renderFixedBlockEditor(Editor, block, props, updateBlock) {
  const set = (patch) => updateBlock(block.id, patch);

  return (
    <BlockEditorShell blockType={block.type}>
      <AnchorControl block={block} value={block.s?.anchorId || ''} set={set} />
      {renderLazyEditor(Editor, { ...props, s: block.s || {}, set })}
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