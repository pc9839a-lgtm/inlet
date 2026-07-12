import { ImageInput } from '../controls.jsx';
import { SegmentedControl } from '../ui/index.js';

export default function HeroImageSection({ s, set, Range }) {
  const mode = s.imageMode === 'full' ? 'full' : 'top';

  return (
    <>
      <SegmentedControl
        label="이미지 배치"
        description="일반은 이미지와 문구를 분리하고, 전체 이미지는 배경처럼 사용합니다."
        value={mode}
        onChange={(value) => set({ imageMode: value, imageFit: value === 'full' ? 'cover' : 'contain' })}
        options={[
          { value: 'top', label: '일반' },
          { value: 'full', label: '전체 이미지' },
        ]}
      />
      <ImageInput label="히어로 이미지" value={s.image} onChange={(value) => set({ image: value })} />
      {mode === 'full' && (
        <SegmentedControl
          label="이미지 확장"
          value={s.heroBleed || 'content'}
          onChange={(value) => set({ heroBleed: value, imageFit: 'cover' })}
          options={[
            { value: 'content', label: '콘텐츠 영역' },
            { value: 'page', label: '페이지 배경까지' },
          ]}
        />
      )}
      <Range label="이미지 높이" value={s.imageHeightPx ?? 320} min={180} max={720} onChange={(value) => set({ imageHeightPx: Number(value) })} />
      {mode === 'full' && (
        <Range label="오버레이" value={s.overlayOpacity ?? 38} min={0} max={85} onChange={(value) => set({ overlay: true, overlayOpacity: Number(value) })} />
      )}
    </>
  );
}