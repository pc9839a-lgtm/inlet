import RichField from '../RichField.jsx';

export default function CardsBasicSection({ title, desc, onChange }) {
  return (
    <>
      <RichField variant="v2" label="제목" description="카드 목록 위에 표시할 제목입니다." value={title} onChange={(value) => onChange({ title: value })} />
      <RichField variant="v2" label="설명" description="카드 목록을 간단히 소개합니다." value={desc} onChange={(value) => onChange({ desc: value })} />
    </>
  );
}