import { SegmentedControl, ToggleRow } from '../ui/index.js';

export default function ImageGalleryDisplaySection({ s, set }) {
  if (s.mode !== 'gallery') return null;

  const layout = s.galleryLayout === 'grid' ? 'grid' : 'slide';

  return (
    <div className="image-slide-options editor-v2-control-list">
      <SegmentedControl
        label="갤러리 배치"
        value={layout}
        onChange={(value) => set({ galleryLayout: value })}
        options={[
          { value: 'slide', label: '슬라이드' },
          { value: 'grid', label: '그리드' },
        ]}
      />
      {layout === 'slide' ? (
        <>
          <ToggleRow
            label="자동 전환"
            checked={Boolean(s.autoplay)}
            onChange={(value) => set({ autoplay: value })}
          />
          {s.autoplay && (
            <SegmentedControl
              label="전환 시간"
              value={String(s.interval || 5)}
              onChange={(value) => set({ interval: Number(value) })}
              options={[
                { value: '3', label: '3초' },
                { value: '5', label: '5초' },
                { value: '7', label: '7초' },
              ]}
            />
          )}
          <ToggleRow
            label="이동 화살표"
            checked={s.galleryShowArrows ?? true}
            onChange={(value) => set({ galleryShowArrows: value })}
          />
          <ToggleRow
            label="현재 위치 표시"
            checked={s.galleryShowDots ?? true}
            onChange={(value) => set({ galleryShowDots: value })}
          />
        </>
      ) : (
        <p className="image-mode-note compact">최대 4장을 한 화면에 배치합니다.</p>
      )}
    </div>
  );
}
