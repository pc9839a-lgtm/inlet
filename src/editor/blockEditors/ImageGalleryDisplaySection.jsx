import { Choice, Step, Toggle } from '../controls.jsx';

export default function ImageGalleryDisplaySection({ s, set }) {
  if (s.mode !== 'gallery') return null;

  return (
    <Step title="표시" icon="2">
      <div className="image-slide-options">
        <Toggle label="자동전환" icon="▶" checked={s.autoplay} onChange={(v) => set({ autoplay: v })} />
        {s.autoplay && (
          <Choice label="전환 시간" value={String(s.interval)} onChange={(v) => set({ interval: Number(v) })} options={[["3", "3초"], ["5", "5초"], ["7", "7초"]]} />
        )}
        <Toggle label="화살표" icon="‹›" checked={s.galleryShowArrows ?? true} onChange={(v) => set({ galleryShowArrows: v })} />
        <Toggle label="점 표시" icon="•••" checked={s.galleryShowDots ?? true} onChange={(v) => set({ galleryShowDots: v })} />
      </div>
    </Step>
  );
}