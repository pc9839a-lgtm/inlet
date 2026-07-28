import { SegmentedControl, ToggleRow } from '../ui/index.js';

export default function MapDisplaySection({ s, set }) {
  return (
    <>
      <ToggleRow label="지도 앱 버튼" checked={s.showMapLinks !== false} onChange={(value) => set({ showMapLinks: value })} />
      <ToggleRow label="지도 미리보기" checked={s.showEmbedMap !== false} onChange={(value) => set({ showEmbedMap: value })} />
      {s.showEmbedMap !== false && <SegmentedControl label="지도 방식" value={s.mapMode || 'google_embed'} onChange={(value) => set({ mapMode: value })} options={[{ value: 'google_embed', label: 'Google 지도' }, { value: 'osm_fallback', label: '링크만 표시' }]} />}
    </>
  );
}
