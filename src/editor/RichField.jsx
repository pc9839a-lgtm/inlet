import { useEffect, useRef } from 'react';

function normalizeRichHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  const hasUnderline = (node) => {
    const decoration = `${node.style?.textDecoration || ''} ${node.style?.textDecorationLine || ''}`.toLowerCase();
    return decoration.includes('underline');
  };

  const hasBoldWeight = (node) => {
    const weight = String(node.style?.fontWeight || '').toLowerCase();
    if (!weight || weight === 'normal' || weight === '400') return false;
    if (weight === 'bold' || weight === 'bolder') return true;
    const numeric = Number(weight);
    return Number.isFinite(numeric) && numeric >= 600;
  };

  const normalizeColor = (color) => {
    const raw = String(color || '').trim();
    const rgb = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!rgb) return raw;
    return `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  };

  const styleAttr = (node) => {
    const color = normalizeColor(node.style?.color || node.getAttribute?.('color') || '');
    return color ? ` style="color:${color}"` : '';
  };

  const clean = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    let inner = Array.from(node.childNodes).map(clean).join('');

    if (tag === 'br') return '<br>';
    if (tag === 'strong' || tag === 'b' || hasBoldWeight(node)) inner = `<strong>${inner}</strong>`;
    if (tag === 'u' || hasUnderline(node)) inner = `<u>${inner}</u>`;

    if (tag === 'span' || tag === 'font') {
      const style = styleAttr(node);
      return style ? `<span${style}>${inner}</span>` : inner;
    }

    if (tag === 'div' || tag === 'p') return `${inner}<br>`;
    return inner;
  };

  return Array.from(root.childNodes).map(clean).join('').replace(/(<br>\s*)+$/g, '');
}

function plainRichText(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  return doc.body.textContent || '';
}

export default function RichField({ label, value, onChange }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const lastValue = useRef(String(value || ''));

  useEffect(() => {
    const el = ref.current;
    const next = String(value || '');
    if (!el) return;
    if (document.activeElement === el) return;
    if (lastValue.current === next && el.innerHTML === next) return;
    el.innerHTML = next;
    lastValue.current = next;
  }, [value]);

  useEffect(() => {
    const onSelectionChange = () => rememberSelection();
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const rememberSelection = () => {
    const el = ref.current;
    const sel = window.getSelection?.();
    if (!el || !sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = ref.current;
    const sel = window.getSelection?.();
    const range = savedRange.current;
    if (!el || !sel || !range || !el.contains(range.commonAncestorContainer)) return null;
    sel.removeAllRanges();
    sel.addRange(range.cloneRange());
    return sel.getRangeAt(0);
  };

  const selectAllWhenNoSelection = () => {
    const el = ref.current;
    const sel = window.getSelection?.();
    if (!el || !sel) return;
    const activeRange = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (activeRange && el.contains(activeRange.commonAncestorContainer) && !activeRange.collapsed) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange.current = range.cloneRange();
  };

  const save = () => {
    const html = normalizeRichHtml(ref.current?.innerHTML || '');
    lastValue.current = html;
    onChange(html);
  };

  const applyInline = (type, color = '#2563eb') => {
    const el = ref.current;
    if (!el) return;
    el.focus();

    restoreSelection();
    if (type === 'color') selectAllWhenNoSelection();
    if (type === 'bold') document.execCommand('bold');
    if (type === 'underline') document.execCommand('underline');
    if (type === 'color') document.execCommand('foreColor', false, color);
    rememberSelection();
    save();
    window.requestAnimationFrame(() => {
      rememberSelection();
      save();
    });
  };

  const applyColor = (color) => {
    if (!color) return;
    applyInline('color', color);
  };

  return (
    <div className="rich-field rich-field-wysiwyg">
      <div className="rich-head">
        <span>{label}</span>
        <div>
          <button type="button" onMouseDown={(e)=>{e.preventDefault(); applyInline('bold');}} title="선택 영역 굵게">B</button>
          <button type="button" onMouseDown={(e)=>{e.preventDefault(); applyInline('underline');}} title="선택 영역 밑줄">U</button>
          <label className="rich-color" title="선택 영역 색상" onMouseDown={rememberSelection} onPointerDown={rememberSelection}>
            <input
              type="color"
              defaultValue="#2563eb"
              onPointerDown={rememberSelection}
              onInput={(e)=>applyColor(e.target.value)}
              onChange={(e)=>applyColor(e.target.value)}
            />
            <i>색</i>
          </label>
        </div>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={save}
        onBlur={save}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onPaste={(e)=>{
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          save();
        }}
      />
    </div>
  );
}

