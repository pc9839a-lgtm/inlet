import { useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '../../lib/uiFeedback.js';
import { T } from './formEditorModel.js';

export function useFormHtmlModal({ form, page, onClose, generateStandaloneFormHtml }) {
  const code = useMemo(() => (
    typeof generateStandaloneFormHtml === 'function' ? generateStandaloneFormHtml(form, page) : ''
  ), [form, page, generateStandaloneFormHtml]);
  const [showCode, setShowCode] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const focusable = dialogRef.current?.querySelector?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus?.();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      notify(T.copied, 'success');
    } catch {
      notify(T.copyFail, 'error');
      setShowCode(true);
    }
  };

  return { code, copy, dialogRef, setShowCode, showCode };
}