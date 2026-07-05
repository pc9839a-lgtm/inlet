import { META } from '../config/blockMeta.jsx';
import { getEditPanelBlocks, isNormalBlockId } from './editPanelBlocks.js';

export function getEditPanelSelectionBlocks(page) {
  return getEditPanelBlocks(page);
}

export function resolveSelectedNormalId({ normalBlocks, openId, selectedNormalId }) {
  const openIdIsNormalBlock = isNormalBlockId(normalBlocks, openId);
  const selectedNormalIdIsValid = isNormalBlockId(normalBlocks, selectedNormalId);

  return selectedNormalIdIsValid
    ? selectedNormalId
    : (openIdIsNormalBlock ? openId : normalBlocks[0]?.id || '');
}

export function findSelectedNormalBlock(normalBlocks, normalSelectedId) {
  return normalBlocks.find((block) => block.id === normalSelectedId);
}

export function getSelectedNormalMeta(selectedNormalBlock) {
  return selectedNormalBlock ? META[selectedNormalBlock.type] || META.text : null;
}

export function shouldHideTopNavControl(page, topNavBlock) {
  return page.slug === 'our-wedding-day' || topNavBlock?.s?.omitEditor;
}

export function isSelectedOpenIdNormalBlock(normalBlocks, openId) {
  return isNormalBlockId(normalBlocks, openId);
}