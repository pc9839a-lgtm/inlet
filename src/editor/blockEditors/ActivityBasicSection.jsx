import { Field } from '../controls.jsx';
import { SegmentedControl } from '../ui/index.js';

export default function ActivityBasicSection({ s, set, dataSource }) {
  return (
    <>
      <Field label="제목" value={s.title || '접수 현황'} onChange={(value) => set({ title: value })} />
      <SegmentedControl label="데이터" value={dataSource} onChange={(value) => set({ dataSource: value })} options={[{ value: 'sample', label: '예시' }, { value: 'live', label: '실제 접수' }]} />
      {dataSource === 'sample' && <SegmentedControl label="예시 유형" value={s.sampleKind || 'both'} onChange={(value) => set({ sampleKind: value })} options={[{ value: 'consult', label: '상담' }, { value: 'reservation', label: '예약' }, { value: 'both', label: '전체' }]} />}
    </>
  );
}