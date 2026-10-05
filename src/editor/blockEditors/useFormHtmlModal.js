import { useMemo, useState } from 'react';
import { notify } from '../../lib/uiFeedback.js';
import { T } from './formEditorModel.js';
import { useAccessibleDialog } from '../../lib/useAccessibleDialog.js';

export function useFormHtmlModal({ form, page, onClose, generateStandaloneFormHtml }) {
  const code = useMemo(() => (
    typeof generateStandaloneFormHtml === 'function' ? generateStandaloneFormHtml(form, page) : ''
  ), [form, page, generateStandaloneFormHtml]);
  const [showCode, setShowCode] = useState(false);
  const dialogRef = useAccessibleDialog(onClose);

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