import { SINGLETON_BLOCK_TYPES } from '../../config/blockMeta.jsx';

export function canDuplicateScreenOrderBlock(block) {
  return !SINGLETON_BLOCK_TYPES.includes(block.type) && block.s?.widgetMode !== 'bgm';
}
