import { Choice, Color, EditorStack, ImageInput, Step } from '../controls.jsx';
import { alignOptions, sizeOptions } from '../editorOptions.js';

export default function HeroEditor({ s, set, Range, RichField }) {
  const mode = s.imageMode === 'full' ? 'full' : 'top';

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <RichField label="제목" value={s.title} onChange={(v) => set({ title: v })} />
        <RichField label="설명" value={s.body} onChange={(v) => set({ body: v })} />
      </Step>

      <Step title="표시" icon="2" open>
        <Choice
          label="표시"
          value={mode}
          onChange={(v) => set({ imageMode: v, imageFit: v === 'full' ? 'cover' : 'contain' })}
          options={[['top', '일반'], ['full', '전체이미지']]}
        />
        <ImageInput label="히어로 이미지" value={s.image} onChange={(v) => set({ image: v })} />
        {mode === 'full' && (
          <>
            <Choice
              label="확장"
              value={s.heroBleed || 'content'}
              onChange={(v) => set({ heroBleed: v, imageFit: 'cover' })}
              options={[['content', '기본'], ['page', '배경까지']]}
            />
          </>
        )}
        <Range label="이미지 높이" value={s.imageHeightPx ?? 320} min={180} max={720} onChange={(v) => set({ imageHeightPx: Number(v) })} />
        {mode === 'full' && (
          <>
            <Range label="오버레이" value={s.overlayOpacity ?? 38} min={0} max={85} onChange={(v) => set({ overlay: true, overlayOpacity: Number(v) })} />
            <Color label="오버레이 색상" value={s.overlayColor || '#000000'} onChange={(v) => set({ overlayColor: v })} />
          </>
        )}
        <div className="hero-mode-note">전체이미지는 히어로 영역 전체를 이미지로 채우고, 오버레이 위에 텍스트를 표시합니다.</div>
      </Step>

      <Step title="디자인" icon="3">
        <Choice label="정렬" value={s.align} onChange={(v) => set({ align: v })} options={alignOptions} />
        <Choice label="제목" value={s.titleSize} onChange={(v) => set({ titleSize: v })} options={sizeOptions} />
        <Choice label="본문" value={s.bodySize} onChange={(v) => set({ bodySize: v })} options={sizeOptions} />
        <Choice label="높이" value={s.height} onChange={(v) => set({ height: v })} options={sizeOptions} />
      </Step>
    </EditorStack>
  );
}
