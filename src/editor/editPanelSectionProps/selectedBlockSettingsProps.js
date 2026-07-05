export function createSelectedBlockSettingsProps({ selection, renderBlockEditor }) {
  return {
    block: selection.selectedNormalBlock,
    meta: selection.selectedNormalMeta,
    renderBlockEditor,
  };
}