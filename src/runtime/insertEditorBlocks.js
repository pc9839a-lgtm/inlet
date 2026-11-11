// Insert ordinary content in the user's current composition context.
// Fixed bottom regions must remain after newly inserted content.
const TRAILING_FIXED = new Set(['bottombar', 'footer']);
const FIXED = new Set(['topnav', 'bottombar', 'footer']);

export function insertBlocksAfterSelection(blocks, additions, selectedId = '') {
  if (!Array.isArray(blocks) || !Array.isArray(additions) || additions.length === 0) return blocks;
  const trailingIndex = blocks.findIndex((block) => TRAILING_FIXED.has(block?.type));
  const tailStart = trailingIndex < 0 ? blocks.length : trailingIndex;
  const selectedIndex = blocks.findIndex((block) => block?.id === selectedId);

  let position = tailStart;
  if (selectedIndex >= 0) {
    const selected = blocks[selectedIndex];
    if (!FIXED.has(selected.type)) {
      position = Math.min(selectedIndex + 1, tailStart);
    } else if (selected.type === 'topnav') {
      const firstNormal = blocks.findIndex((block) => !FIXED.has(block?.type));
      position = firstNormal < 0 ? tailStart : Math.min(firstNormal, tailStart);
    }
  }

  return [...blocks.slice(0, position), ...additions, ...blocks.slice(position)];
}
