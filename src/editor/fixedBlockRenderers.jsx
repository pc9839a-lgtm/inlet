import { renderLazyEditor } from '../runtime/LazyRuntimeBoundary.jsx';
import { BottomBarEditor, FooterEditor, TopNavEditor } from './blockEditorRegistry.jsx';
import TargetControl from './TargetControl.jsx';

export function createFixedBlockRenderers({ page, updateBlock }) {
  return {
    renderTopNavEditor: (block) => renderLazyEditor(TopNavEditor, {
      s: block.s || {},
      set: (patch) => updateBlock(block.id, patch),
      page,
      TargetControl,
    }),
    renderBottomBarEditor: (block) => renderLazyEditor(BottomBarEditor, {
      s: block.s || {},
      set: (patch) => updateBlock(block.id, patch),
      page,
    }),
    renderFooterEditor: (block) => renderLazyEditor(FooterEditor, {
      s: block.s || {},
      set: (patch) => updateBlock(block.id, patch),
      page,
    }),
  };
}