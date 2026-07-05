import { META, SINGLETON_BLOCK_TYPES } from '../../config/blockMeta.jsx';

export function getAddableBlocksByCategory(category) {
  return Object.entries(META).filter(([type, meta]) => {
    if (SINGLETON_BLOCK_TYPES.includes(type)) return false;
    return (meta.category || 'content') === category;
  });
}
