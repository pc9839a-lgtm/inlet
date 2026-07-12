import { SegmentedControl, ToggleRow } from '../ui/index.js';

export default function SearchDisplaySection({ s, set }) {
  return (
    <>
      <SegmentedControl label="형태" value={s.layout || 'card'} onChange={(value) => set({ layout: value })} options={[{ value: 'card', label: '카드' }, { value: 'bar', label: '바' }, { value: 'minimal', label: '심플' }]} />
      <ToggleRow label="실시간 검색" description="입력하는 동안 결과를 바로 갱신합니다." checked={s.live !== false} onChange={(value) => set({ live: value })} />
    </>
  );
}