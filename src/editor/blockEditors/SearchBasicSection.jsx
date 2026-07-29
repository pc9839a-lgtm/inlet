import { Field } from '../controls.jsx';

export default function SearchBasicSection({ s, set }) {
  return (
    <>
      <Field label="제목" value={s.title ?? '페이지 검색'} onChange={(value) => set({ title: value })} />
      <Field label="안내 문구" value={s.placeholder || '찾을 내용을 입력하세요'} onChange={(value) => set({ placeholder: value })} />
      <Field label="결과 없음" value={s.emptyText || '일치하는 내용이 없습니다.'} onChange={(value) => set({ emptyText: value })} />
    </>
  );
}