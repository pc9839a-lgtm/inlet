import { SINGLETON_BLOCK_TYPES } from '../config/blockMeta.jsx';
import { clone, ensureUniqueAnchors, newBlock, sanitizeBlock, uid } from '../lib/pageModel.js';
import { createVideoCodeSettings } from '../lib/youtubeEmbed.js';

const FIXED_BLOCK_TYPES = ['topnav', 'bottombar', 'footer'];

export function useEditorBlockActions({
  page,
  openId,
  blockWrite,
  setPage,
  commitLocalPageDraft,
  setOpenId,
  setAddOpen,
}) {
  const updateBlock = (id, patch) => {
    if (blockWrite('edit')) return;
    setPage((p) => commitLocalPageDraft({
      ...p,
      blocks: ensureUniqueAnchors(p.blocks.map((b) => b.id === id ? sanitizeBlock({ ...b, s: { ...b.s, ...patch } }) : b)),
    }));
  };

  const toggleVisible = (id) => {
    if (blockWrite('edit')) return;
    setPage((p) => commitLocalPageDraft({ ...p, blocks: p.blocks.map((b) => b.id === id ? { ...b, visible: !b.visible } : b) }));
  };

  const addBlock = (type) => {
    if (blockWrite('edit')) return;
    if (SINGLETON_BLOCK_TYPES.includes(type)) {
      const existing = page.blocks.find((b) => b.type === type);
      if (existing) {
        setOpenId(existing.id);
        setAddOpen(false);
        return;
      }
    }
    const block = type === 'youtube'
      ? sanitizeBlock({
        id: uid(),
        type: 'code',
        visible: true,
        s: { anchorId: 'video', ...createVideoCodeSettings('') },
      })
      : newBlock(type);
    setPage((p) => commitLocalPageDraft({ ...p, blocks: ensureUniqueAnchors([...p.blocks, block]) }));
    setOpenId(block.id);
    setAddOpen(false);
  };

  const removeBlock = (id) => {
    if (blockWrite('edit')) return;
    let nextOpen = openId;
    if (openId === id) {
      const normalBlocks = page.blocks.filter((block) => !FIXED_BLOCK_TYPES.includes(block.type));
      const index = normalBlocks.findIndex((block) => block.id === id);
      nextOpen = normalBlocks[index + 1]?.id || normalBlocks[index - 1]?.id || '';
    }
    setPage((p) => commitLocalPageDraft({ ...p, blocks: ensureUniqueAnchors(p.blocks.filter((b) => b.id !== id)) }));
    setOpenId(nextOpen);
    setAddOpen(false);
  };

  const duplicateBlock = (id) => {
    if (blockWrite('edit')) return;
    const source = page.blocks.find((b) => b.id === id);
    if (!source || SINGLETON_BLOCK_TYPES.includes(source.type) || source.s?.widgetMode === 'bgm') return;
    const copy = clone(source);
    copy.id = uid();
    setPage((p) => {
      const idx = p.blocks.findIndex((b) => b.id === id);
      if (idx < 0 || SINGLETON_BLOCK_TYPES.includes(p.blocks[idx].type) || p.blocks[idx].s?.widgetMode === 'bgm') return p;
      const next = [...p.blocks];
      next.splice(idx + 1, 0, copy);
      return commitLocalPageDraft({ ...p, blocks: ensureUniqueAnchors(next) });
    });
    setOpenId(copy.id);
    setAddOpen(false);
  };

  const reorderToIndex = (fromId, targetIndex) => {
    if (blockWrite('edit')) return;
    if (!fromId && fromId !== 0) return;
    setPage((p) => {
      const normal = p.blocks.filter((b) => !FIXED_BLOCK_TYPES.includes(b.type));
      const fixed = p.blocks.filter((b) => FIXED_BLOCK_TYPES.includes(b.type));
      const from = normal.findIndex((b) => b.id === fromId);
      if (from < 0) return p;
      const nextNormal = [...normal];
      const [moved] = nextNormal.splice(from, 1);
      const requestedIndex = Number(targetIndex);
      const adjustedIndex = from < requestedIndex ? requestedIndex - 1 : requestedIndex;
      const safeIndex = Math.max(0, Math.min(adjustedIndex, nextNormal.length));
      nextNormal.splice(safeIndex, 0, moved);
      return commitLocalPageDraft({ ...p, blocks: ensureUniqueAnchors([...nextNormal, ...fixed]) });
    });
  };

  return {
    updateBlock,
    toggleVisible,
    addBlock,
    removeBlock,
    duplicateBlock,
    reorderToIndex,
  };
}
