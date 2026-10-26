import { FormHtmlModal } from './FormHtmlModal.jsx';
import { Code2 } from 'lucide-react';

export default function FormExternalSection({ s, page, blockId, htmlOpen, setHtmlOpen, generateStandaloneFormHtml }) {
  return (
    <>
      <button type="button" className="form-embed-button" onClick={() => setHtmlOpen(true)}><Code2 size={16} aria-hidden="true" />외부 사이트에 넣기</button>
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
