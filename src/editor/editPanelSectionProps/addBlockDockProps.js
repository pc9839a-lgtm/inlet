export function createAddBlockDockProps({ addOpen, setAddOpen, openId, normalBlocks = [], addBlock, addSectionPattern }) {
  return {
    addOpen,
    setAddOpen,
    openId,
    afterSelected: normalBlocks.some((block) => block.id === openId),
    addBlock,
    addSectionPattern,
  };
}