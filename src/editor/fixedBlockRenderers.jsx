import { renderLazyEditor } from '../runtime/LazyRuntimeBoundary.jsx';
import { BlockAdvancedAnchorSettings } from './BlockAdvancedAnchorSettings.jsx';
import { BottomBarEditor, FooterEditor, TopNavEditor } from './blockEditorRegistry.jsx';
import TargetControl from './TargetControl.jsx';
import { BlockEditorShell } from './ui/index.js';

function renderFixedBlockEditor(Editor, block, props, updateBlock) {
  const set = (patch) => updateBlock(block.id, patch);

  return (
    <BlockEditorShell blockType={block.type}>
      {renderLazyEditor(Editor, { ...props, s: block.s || {}, set })}
      <BlockAdvancedAnchorSettings block={block} set={set} />
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