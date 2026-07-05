import { FIXED_BLOCK_TYPES } from './editPanelParts/editorLabels.js';

export function getEditPanelBlocks(page) {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
  const topNavBlock = blocks.find((block) => block.type === 'topnav');
  const bottomBlock = blocks.find((block) => block.type === 'bottombar');
  const footerBlock = blocks.find((block) => block.type === 'footer');
  const normalBlocks = blocks.filter((block) => !FIXED_BLOCK_TYPES.includes(block.type));

  return { topNavBlock, bottomBlock, footerBlock, normalBlocks };
}

export function isNormalBlockId(blocks, blockId) {
  if (!blockId) return false;
  return blocks.some((block) => block.id === blockId);
}