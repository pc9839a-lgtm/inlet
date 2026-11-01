import { useEffect, useRef, useState } from 'react';
import { FileText, MousePointer2, Paintbrush, SlidersHorizontal } from 'lucide-react';

const STYLE = '.text-editor-design, .hero-editor-design, .form-design-detail, .topnav-editor-design, .bottom-bar-editor-design, .image-editor-more, .code-editor-options';

export function InspectorNavigation({ blockType }) {
  const ref = useRef(null);
  const [available, setAvailable] = useState({ style: false, behavior: false });
  const [active, setActive] = useState('content');
  useEffect(() => {
    const root = ref.current?.closest('.screen-order-v2-settings-view');
    if (!root) return undefined;
    const scan = () => {
      const styleTab = [...root.querySelectorAll('.editor-tabs-v2-list button')].some(el => /스타일|디자인/.test(el.textContent));
      const next = { style: blockType !== 'code' && Boolean(root.querySelector(STYLE) || styleTab), behavior: blockType !== 'code' && Boolean(root.querySelector('.target-control')) };
      setAvailable(current => current.style === next.style && current.behavior === next.behavior ? current : next);
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [blockType]);

  const go = (id) => {
    const root = ref.current.closest('.screen-order-v2-settings-view');
    const scroller = root.closest('.editor-inspector-panel');
    let target = root.querySelector('.block-editor-v2');
    if (id === 'style') {
      target = root.querySelector(STYLE);
      if (!target) {
        [...root.querySelectorAll('.editor-tabs-v2-list button')].find(el => /스타일|디자인/.test(el.textContent))?.click();
        target = root.querySelector('.editor-tabs-v2-panel');
      }
    } else if (id === 'behavior') target = root.querySelector('.target-control');
    else if (id === 'advanced') target = root.querySelector('.block-editor-advanced-settings');
    else {
      const tabs = root.querySelector('.editor-tabs-v2-list');
      [...(tabs?.querySelectorAll('button') || [])].find(el => /내용|기본|코드/.test(el.textContent))?.click();
    }
    if (target?.tagName === 'DETAILS') target.open = true;
    setActive(id);
    requestAnimationFrame(() => {
      if (!target || !scroller) return;
      const headerHeight = root.querySelector('.screen-order-v2-settings-header')?.offsetHeight || 0;
      scroller.scrollTop = id === 'content' ? 0 : Math.max(0, scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headerHeight - 12);
    });
  };
  const options = [['content', '내용', FileText], ...(available.style ? [['style', '스타일', Paintbrush]] : []), ...(available.behavior ? [['behavior', '동작', MousePointer2]] : []), ['advanced', '고급', SlidersHorizontal]];
  return <nav className="inspector-navigation" aria-label="선택 항목 설정 바로가기" ref={ref}>
    {options.map(([id, label, Icon]) => <button type="button" key={id} aria-pressed={active === id} onClick={() => go(id)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}
  </nav>;
}
