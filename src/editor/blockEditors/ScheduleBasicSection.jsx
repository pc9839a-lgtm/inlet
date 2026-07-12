import { Field } from '../controls.jsx';

export default function ScheduleBasicSection({ s, set }) {
  return (
    <>
      <Field label="제목" value={s.title || '일정 안내'} onChange={(value) => set({ title: value })} />
      <Field label="날짜" type="date" value={s.date || ''} onChange={(value) => set({ date: value })} />
      <Field label="상세 내용" textarea value={s.body || ''} placeholder="시간, 장소, 안내 문구를 입력하세요" onChange={(value) => set({ body: value })} />
      <Field label="월 표기" value={s.monthLabel || ''} placeholder="비워두면 날짜 기준으로 표시" onChange={(value) => set({ monthLabel: value })} />
    </>
  );
}