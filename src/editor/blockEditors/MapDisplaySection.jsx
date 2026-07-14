import { SegmentedControl } from '../ui/index.js';

export default function MapDisplaySection({ s, set }) {
  return (
    <>
      <SegmentedControl label="지도 방식" value={s.mapMode || 'google_embed'} onChange={(value) => set({ mapMode: value })} options={[{ value: 'google_embed', label: 'Google 지도' }, { value: 'osm_fallback', label: '링크만 표시' }]} />

    </>
  );
}