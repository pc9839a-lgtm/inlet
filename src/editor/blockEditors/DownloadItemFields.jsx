import { Field } from '../controls.jsx';

export default function DownloadItemFields({ item, onChange }) {
  return (
    <>
      <Field label="표시 문구" value={item.title} onChange={(value) => onChange({ title: value })} />
      <Field label="상세 설명" value={item.desc} onChange={(value) => onChange({ desc: value })} />
    </>
  );
}