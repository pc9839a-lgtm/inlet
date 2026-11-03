// Inspector-only navigation. Existing page blocks are never mutated or reordered.
export function createInspectorBlockNavigation({ normalBlocks = [], fixedDescriptors = [], selectedBlockId = '' } = {}) {
  const fixed = fixedDescriptors.filter((item) => item?.block?.id);
  const top = fixed.filter((item) => item.key === 'topnav').map((item) => item.block.id);
  const normal = normalBlocks.filter((block) => block?.id).map((block) => block.id);
  const bottom = fixed.filter((item) => item.key !== 'topnav').map((item) => item.block.id);
  const ids = [...new Set([...top, ...normal, ...bottom])];
  const index = ids.indexOf(selectedBlockId);
  if (index < 0) return null;
  return {
    index,
    total: ids.length,
    previousId: index > 0 ? ids[index - 1] : '',
    nextId: index < ids.length - 1 ? ids[index + 1] : '',
  };
}
