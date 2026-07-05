import { Field, Step } from '../controls.jsx';

export default function SearchBasicSection({ s, set }) {
  return (
    <Step title="기본" icon="1" open>
      <Field label="제목" value={s.title || '페이지 검색'} onChange={(v) => set({ title: v })} />
      <Field label="안내 문구" value={s.placeholder || '찾을 내용을 입력하세요'} onChange={(v) => set({ placeholder: v })} />
      <Field label="결과 없음" value={s.emptyText || '일치하는 내용이 없습니다.'} onChange={(v) => set({ emptyText: v })} />
    </Step>
  );
}