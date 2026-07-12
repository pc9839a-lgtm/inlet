import { SegmentedControl, ToggleRow } from '../ui/index.js';

export default function ImageGalleryDisplaySection({ s, set }) {
  if (s.mode !== 'gallery') return null;

  return (
    <div className="image-slide-options editor-v2-control-list">
      <ToggleRow
        label="자동 전환"
        description="일정 시간마다 다음 이미지로 이동합니다."
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
        description="방문자가 이전과 다음 이미지를 직접 선택할 수 있습니다."
        checked={s.galleryShowArrows ?? true}
        onChange={(value) => set({ galleryShowArrows: value })}
      />
      <ToggleRow
        label="현재 위치 표시"
        description="갤러리 아래에 현재 이미지 위치를 점으로 표시합니다."
        checked={s.galleryShowDots ?? true}
        onChange={(value) => set({ galleryShowDots: value })}
      />
    </div>
  );
}