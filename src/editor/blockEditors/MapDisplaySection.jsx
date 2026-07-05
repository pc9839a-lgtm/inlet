import { Choice, Step } from '../controls.jsx';

export default function MapDisplaySection({ s, set }) {
  return (
    <Step title="지도" icon="2">
      <Choice
        label="지도 방식"
        value={s.mapMode || 'google_embed'}
        onChange={(v) => set({ mapMode: v })}
        options={[
          ['google_embed', 'Google 지도'],
          ['osm_fallback', '링크만 표시'],
        ]}
      />
      <Choice
        label="지도 높이"
        value={s.height || 'medium'}
        onChange={(v) => set({ height: v })}
        options={[
          ['small', '작게'],
          ['medium', '기본'],
          ['large', '크게'],
        ]}
      />
    </Step>
  );
}