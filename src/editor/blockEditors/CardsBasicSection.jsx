import RichField from '../RichField.jsx';

export default function CardsBasicSection({ title, desc, onChange }) {
  return (
    <>
      <RichField variant="v2" label="제목" value={title} onChange={(value) => onChange({ title: value })} />
      <RichField variant="v2" label="설명" value={desc} onChange={(value) => onChange({ desc: value })} />
    </>
  );
}