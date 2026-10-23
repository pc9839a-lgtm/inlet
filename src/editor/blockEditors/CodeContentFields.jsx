import React from 'react';
import { EditorField } from '../ui/index.js';
import { ImageInput } from '../controls.jsx';
import { readCodeContentFields, updateCodeContentField } from './codeContentFields.js';

export function CodeContentFields({ html, onChange, disabled }) {
  const latest = React.useRef(html);
  latest.current = html;
  const locked = React.useRef(disabled);
  locked.current = disabled;
  const [notice, setNotice] = React.useState('');
  const fields = React.useMemo(() => readCodeContentFields(html), [html]);
  const change = (field, value) => {
    const current = readCodeContentFields(latest.current).find((item) => item.id === field.id);
    // An upload can finish after the user starts a raw code draft. Preserve that draft.
    if (locked.current || !current || (field.kind === 'image' && current.raw !== field.raw)) {
      setNotice('코드가 변경돼 사진 교체를 취소했습니다.');
      return;
    }
    setNotice('');
    const next = updateCodeContentField(latest.current, field.id, value);
    if (next !== latest.current) { latest.current = next; onChange(next); }
  };
  return (
    <div className="code-content-fields" aria-label="내용 편집">
      {disabled && <p role="status">코드 초안을 적용하거나 되돌려 주세요.</p>}
      {notice && <p role="status">{notice}</p>}
      {!fields.length && <p>수정할 항목이 없습니다. 고급 편집에서 코드를 수정하세요.</p>}
      {fields.map((field) => field.kind === 'image'
        ? <ImageInput key={field.id} label={field.label} value={field.value} disabled={disabled} onChange={(value) => change(field, value)} />
        : <EditorField key={field.id} label={field.label}>
          <input type="text" value={field.value} disabled={disabled} data-code-content-field={field.id} data-code-content-kind={field.kind} onChange={(event) => change(field, event.target.value)} />
        </EditorField>)}
    </div>
  );
}
