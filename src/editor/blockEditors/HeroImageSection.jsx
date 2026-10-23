import { ImageInput } from '../controls.jsx';
import { SegmentedControl, ToggleRow } from '../ui/index.js';
import HeroImageRange from './HeroImageRange.jsx';
import './HeroImageSection.css';

export default function HeroImageSection({ s, set, Range }) {
  const mode = ['top', 'background', 'full'].includes(s.imageMode) ? s.imageMode : 'top';
  const showText = s.fullText !== false;
  const filterVisible = mode === 'background' || (mode === 'full' && showText);

  return (
    <div className="hero-image-section">
      <ImageInput label="히어로 이미지" value={s.image} onChange={(value) => set({ image: value })} />
      <SegmentedControl
        label="이미지 배치"
        value={mode}
        onChange={(value) => set({ imageMode: value, imageFit: value === 'full' ? 'cover' : 'contain' })}
        options={[
          { value: 'top', label: '글 위' },
          { value: 'background', label: '글 뒤' },
          { value: 'full', label: '전체 이미지' },
        ]}
      />
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
      {mode !== 'background' && (
        <HeroImageRange Range={Range} label="이미지 높이" unit="px" value={s.imageHeightPx ?? 320} min={180} max={720} onChange={(value) => set({ imageHeightPx: value })} />
      )}
      {mode === 'full' && (
        <ToggleRow label="글자 표시" checked={showText} onChange={(fullText) => set({ fullText })} />
      )}
      {filterVisible && (
        <ToggleRow label="사진 필터" checked={s.overlay !== false} onChange={(overlay) => set({ overlay })} />
      )}
      {filterVisible && s.overlay !== false && (
        <HeroImageRange Range={Range} label="필터 진하기" unit="%" value={s.overlayOpacity ?? 38} min={0} max={85} onChange={(value) => set({ overlayOpacity: value })} />
      )}
    </div>
  );
}
