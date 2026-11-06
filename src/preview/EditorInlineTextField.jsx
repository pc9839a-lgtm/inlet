import React, { useEffect, useRef, useState } from 'react';
import { rich } from './renderers/previewUtils.jsx';
import { canInlineEditTextMarkup, decodeInlineTextMarkup, encodeInlineTextMarkup } from '../editor/previewInlineTextModel.js';
import './EditorInlineTextField.css';

// This component is rendered only by the authenticated editor preview.
// Content is held locally until Apply; no public page or lead side effect.
export function EditorInlineTextField({ as: Element = 'h2', blockId, field, htmlValue, label, onCommit }) {
  const [draft, setDraft] = useState(null);
  const [conflict, setConflict] = useState(false);
  const originalRef = useRef('');
  const viewRef = useRef(null);
  const textareaRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const composingRef = useRef(false);
  const editing = draft !== null;
  const enabled = canInlineEditTextMarkup(htmlValue) && typeof onCommit === 'function';

  useEffect(() => {
    if (editing) textareaRef.current?.focus({ preventScroll: true });
    else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      viewRef.current?.focus({ preventScroll: true });
    }
  }, [editing]);

  const begin = () => {
    if (!enabled || editing) return;
    originalRef.current = htmlValue;
    setDraft(decodeInlineTextMarkup(htmlValue));
    setConflict(false);
  };
  const close = () => {
    restoreFocusRef.current = true;
    setDraft(null);
    setConflict(false);
  };
  const apply = () => {
    if (!editing || composingRef.current) return;
    const nextHtml = encodeInlineTextMarkup(draft);
    if (nextHtml === originalRef.current) {
      close();
      return;
    }
    if (htmlValue !== originalRef.current
      || onCommit(blockId, field, nextHtml, originalRef.current) === false) {
      setConflict(true);
      return;
    }
    close();
  };

  if (!editing) {
    return (
      <Element
        ref={viewRef}
        className={enabled ? 'editor-inline-text-trigger' : undefined}
        tabIndex={enabled ? 0 : undefined}
        aria-label={enabled ? label + ' · Enter 또는 더블클릭으로 바로 수정' : undefined}
        title={enabled ? '더블클릭 또는 Enter로 수정' : undefined}
        onDoubleClick={enabled ? begin : undefined}
        onKeyDown={enabled ? (event) => {
          if (event.key === 'Enter' || event.key === 'F2') {
            event.preventDefault();
            event.stopPropagation();
            begin();
          }
        } : undefined}
      >
        {rich(htmlValue)}
      </Element>
    );
  }

  return (
    <div
      className={'editor-inline-text-edit' + (field === 'title' ? ' is-title' : ' is-body')}
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        aria-label={label + ' 바로 수정'}
        value={draft}
        rows={field === 'title' ? 2 : 4}
        spellCheck
        onChange={(event) => { setDraft(event.target.value); setConflict(false); }}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        onKeyDown={(event) => {
          if (event.nativeEvent?.isComposing || composingRef.current) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            apply();
          }
        }}
      />
      {conflict && <small role="alert">내용이 바뀌었거나 편집할 수 없습니다. 취소 후 다시 열어 주세요.</small>}
      <div className="editor-inline-text-actions">
        <button type="button" onClick={close}>취소</button>
        <button type="button" onClick={apply}>적용</button>
      </div>
    </div>
  );
}
