import { SegmentedControl } from '../ui/index.js';

export default function MapDisplaySection({ s, set }) {
  return (
    <>
      <SegmentedControl label="지도 방식" value={s.mapMode || 'google_embed'} onChange={(value) => set({ mapMode: value })} options={[{ value: 'google_embed', label: 'Google 지도' }, { value: 'osm_fallback', label: '링크만 표시' }]} />
      <SegmentedControl label="지도 높이" value={s.height || 'medium'} onChange={(value) => set({ height: value })} options={[{ value: 'small', label: '작게' }, { value: 'medium', label: '기본' }, { value: 'large', label: '크게' }]} />
    </>
  );
}