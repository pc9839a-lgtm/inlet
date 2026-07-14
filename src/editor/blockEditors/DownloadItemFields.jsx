import { EditorField } from '../ui/index.js';

export default function DownloadItemFields({ item, onChange }) {
  return (
    <>
      <EditorField label="표시 문구">
        <input value={item.title || ''} onChange={(event) => onChange({ title: event.target.value })} />
      </EditorField>
      <EditorField label="상세 설명">
        <textarea value={item.desc || ''} onChange={(event) => onChange({ desc: event.target.value })} />
      </EditorField>
    </>
  );
}