import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, EyeOff, Trash2 } from 'lucide-react';
import { canDuplicateScreenOrderBlock } from '../../editor/editPanelParts/screenOrderActionPolicy.js';

export function PreviewSelectionToolbar({ frameRef, page, selectedBlockId, actions, zoom }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);
  const block = page.blocks?.find(item => item.id === selectedBlockId);
  const normal = page.blocks?.filter(item => !['topnav', 'bottombar', 'footer'].includes(item.type)) || [];
  const index = normal.findIndex(item => item.id === selectedBlockId);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !block || block.visible === false) { setPosition(null); return undefined; }
    const measure = () => {
      const target = frame.querySelector('.preview-selected-block') || frame.querySelector(`#block-${CSS.escape(selectedBlockId)}`);
      if (!target || !ref.current?.parentElement) { setPosition(null); return; }
      const parentBox = ref.current.parentElement.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const next = { top: Math.max(frameBox.top - parentBox.top + 12, targetBox.top - parentBox.top - 48), visible: targetBox.bottom > frameBox.top + 20 && targetBox.top < frameBox.bottom - 20 };
      setPosition(previous => previous?.top === next.top && previous?.visible === next.visible ? previous : next);
    };
    const tick = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    const target = frame.querySelector('.preview-selected-block') || frame.querySelector(`#block-${CSS.escape(selectedBlockId)}`);
    if (target) observer.observe(target);
    frame.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(tick); observer.disconnect(); frame.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [frameRef, selectedBlockId, block, zoom]);
  if (!block || !actions?.toggleVisible) return null;
  return <div className="preview-selection-toolbar" ref={ref} role="toolbar" aria-label="선택 블록 작업" style={{ top: position?.top || 0, visibility: position?.visible ? 'visible' : 'hidden' }}>
    {index >= 0 && canDuplicateScreenOrderBlock(block) && <button type="button" onClick={() => actions.duplicateBlock(block.id)}><Copy size={15} aria-hidden="true" /><span>복제</span></button>}
    <button type="button" onClick={() => actions.toggleVisible(block.id)}><EyeOff size={15} aria-hidden="true" /><span>숨기기</span></button>
    {index >= 0 && <>
      <button type="button" aria-label="블록 위로 이동" disabled={index === 0} onClick={() => actions.reorderToIndex(block.id, index - 1)}><ArrowUp size={16} aria-hidden="true" /></button>
      <button type="button" aria-label="블록 아래로 이동" disabled={index === normal.length - 1} onClick={() => actions.reorderToIndex(block.id, index + 1)}><ArrowDown size={16} aria-hidden="true" /></button>
      <button type="button" aria-label="블록 삭제" onClick={() => actions.removeBlock(block.id)}><Trash2 size={16} aria-hidden="true" /></button>
    </>}
  </div>;
}
