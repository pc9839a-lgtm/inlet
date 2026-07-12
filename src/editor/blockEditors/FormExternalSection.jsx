import { FormHtmlModal } from './FormHtmlModal.jsx';
import { T } from './formEditorModel.js';

export default function FormExternalSection({ s, page, blockId, htmlOpen, setHtmlOpen, generateStandaloneFormHtml }) {
  return (
    <>
      <div className="form-advanced-group">
        <div className="inlet-export-card compact">
          <strong>{T.formCode}</strong>
          <p>{T.codeDesc}</p>
          <button type="button" onClick={() => setHtmlOpen(true)}>{T.openCode}</button>
        </div>
      </div>
      {htmlOpen && (
        <FormHtmlModal
          form={{ ...s, blockId }}
          page={page}
          generateStandaloneFormHtml={generateStandaloneFormHtml}
          onClose={() => setHtmlOpen(false)}
        />
      )}
    </>
  );
}