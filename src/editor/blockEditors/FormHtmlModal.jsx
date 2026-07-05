import { createPortal } from 'react-dom';
import { T } from './formEditorModel.js';
import FormHtmlModalActions from './FormHtmlModalActions.jsx';
import FormHtmlModalHeader from './FormHtmlModalHeader.jsx';
import FormHtmlModalNotice from './FormHtmlModalNotice.jsx';
import { useFormHtmlModal } from './useFormHtmlModal.js';

export function FormHtmlModal({ form, page, onClose, generateStandaloneFormHtml }) {
  const { code, copy, dialogRef, setShowCode, showCode } = useFormHtmlModal({ form, page, onClose, generateStandaloneFormHtml });

  return createPortal(
    <div className="inlet-html-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} className="inlet-html-modal compact" role="dialog" aria-modal="true" aria-labelledby="inlet-html-modal-title">
        <FormHtmlModalHeader
          title={T.formCode}
          description={T.modalDesc}
          closeLabel={T.close}
          onClose={onClose}
        />
        <FormHtmlModalNotice badge={T.freeBadge} description={T.freeDesc} />
        {showCode && <textarea readOnly value={code} />}
        <FormHtmlModalActions
          showCode={showCode}
          labels={T}
          onToggleCode={() => setShowCode(!showCode)}
          onClose={onClose}
          onCopy={copy}
        />
      </div>
    </div>,
    document.body
  );
}