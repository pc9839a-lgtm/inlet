import { EditorField } from '../ui/index.js';

export default function DownloadItemFields({ item, onChange }) {
  return (
    <>
      <EditorField label="표시 문구" description="방문자에게 보이는 파일 이름입니다.">
        <input value={item.title || ''} onChange={(event) => onChange({ title: event.target.value })} />
      </EditorField>
      <EditorField label="상세 설명" description="파일의 내용이나 이용 방법을 간단히 안내합니다.">
        <textarea value={item.desc || ''} onChange={(event) => onChange({ desc: event.target.value })} />
      </EditorField>
    </>
  );
}