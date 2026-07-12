import { Field } from '../controls.jsx';
import { SegmentedControl } from '../ui/index.js';

export default function ActivityDisplaySection({ s, set, dataSource, mode }) {
  return (
    <>
      <SegmentedControl label="표시" value={mode} onChange={(value) => set({ mode: value })} options={[{ value: 'feed', label: '접수 목록' }, { value: 'count', label: '숫자' }]} />
      {mode === 'count' && dataSource === 'sample' && <Field label="예시 숫자" type="number" value={s.baseCount ?? 12} onChange={(value) => set({ baseCount: Number(value) })} />}
    </>
  );
}