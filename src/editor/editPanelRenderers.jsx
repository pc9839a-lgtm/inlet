import { createBlockSettingsRenderer } from './blockSettingsRenderer.jsx';
import { createFixedBlockRenderers } from './fixedBlockRenderers.jsx';

export function createEditPanelRenderers({ page, updateBlock, authUser }) {
  return {
    ...createFixedBlockRenderers({ page, updateBlock }),
    renderBlockEditor: createBlockSettingsRenderer({ page, updateBlock, authUser }),
  };
}