import { Choice, Field, Step } from '../controls.jsx';

export default function ActivityBasicSection({ s, set, dataSource }) {
  return (
    <Step title="기본" icon="1" open>
      <Field label="제목" value={s.title || '접수 현황'} onChange={(v) => set({ title: v })} />
      <Choice
        label="데이터"
        value={dataSource}
        onChange={(v) => set({ dataSource: v })}
        options={[
          ['sample', '예시'],
          ['live', '실제 접수'],
        ]}
      />
      {dataSource === 'sample' && (
        <Choice
          label="예시 유형"
          value={s.sampleKind || 'both'}
          onChange={(v) => set({ sampleKind: v })}
          options={[
            ['consult', '상담'],
            ['reservation', '예약'],
            ['both', '전체'],
          ]}
        />
      )}
    </Step>
  );
}