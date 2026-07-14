import { Color } from '../controls.jsx';
import { SegmentedControl, ToggleRow } from '../ui/index.js';

const ALIGN = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
];
const ALIGN_NO_RIGHT = ALIGN.slice(0, 2);
const SIZES = [
  { value: 'small', label: '작게' },
  { value: 'medium', label: '기본' },
  { value: 'large', label: '크게' },
];

function spacingPreset(value) {
  const amount = Number(value ?? 24);
  if (amount <= 14) return 'compact';
  if (amount >= 34) return 'wide';
  return 'normal';
}

function WidgetSurfaceControls({
  s,
  set,
  align = true,
  alignOptions = ALIGN,
  defaultAlign = 'left',
  showBackground = true,
  showShadow = true,
}) {
  return (
    <div className="editor-v2-control-list">
      {align && <SegmentedControl label="정렬" value={s.align || defaultAlign} onChange={(value) => set({ align: value })} options={alignOptions} />}
      <SegmentedControl
        label="위아래 여백"
        value={spacingPreset(s.marginY)}
        onChange={(value) => set({ marginY: { compact: 12, normal: 24, wide: 36 }[value] })}
        options={[{ value: 'compact', label: '좁게' }, { value: 'normal', label: '기본' }, { value: 'wide', label: '넓게' }]}
      />
      {showBackground && <ToggleRow label="배경 직접 지정" checked={Boolean(s.bgEnabled)} onChange={(value) => set({ bgEnabled: value })} />}
      {showBackground && s.bgEnabled && (
        <>
          <Color label="배경색" value={s.bgColor || '#FFFFFF'} onChange={(value) => set({ bgColor: value })} />
          <SegmentedControl
            label="안쪽 여백"
            value={spacingPreset(s.paddingY)}
            onChange={(value) => set({ paddingY: { compact: 14, normal: 22, wide: 32 }[value] })}
            options={[{ value: 'compact', label: '좁게' }, { value: 'normal', label: '기본' }, { value: 'wide', label: '넓게' }]}
          />
        </>
      )}
      <SegmentedControl label="모서리" value={s.radiusStyle || 'round'} onChange={(value) => set({ radiusStyle: value })} options={[{ value: 'square', label: '각지게' }, { value: 'round', label: '둥글게' }]} />
      {showShadow && <ToggleRow label="그림자 추가" checked={Boolean(s.shadowEnabled)} onChange={(value) => set({ shadowEnabled: value })} />}
    </div>
  );
}

export function HeroStylePanel({ s, set }) {
  return <div className="editor-v2-control-list">
    <SegmentedControl label="정렬" value={s.align || 'left'} onChange={(value) => set({ align: value })} options={ALIGN} />
    <SegmentedControl label="제목 크기" value={s.titleSize || 'large'} onChange={(value) => set({ titleSize: value })} options={SIZES} />
    <SegmentedControl label="설명 크기" value={s.bodySize || 'medium'} onChange={(value) => set({ bodySize: value })} options={SIZES} />
    <ToggleRow label="제목 굵게" checked={Boolean(s.bold)} onChange={(value) => set({ bold: value })} />
    <ToggleRow label="제목 밑줄" checked={Boolean(s.underline)} onChange={(value) => set({ underline: value })} />
  </div>;
}

export function TextStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="형태" value={s.layout || 'plain'} onChange={(value) => set({ layout: value })} options={[{ value: 'plain', label: '기본' }, { value: 'card', label: '카드' }, { value: 'notice', label: '강조' }]} />
    <SegmentedControl label="글자 크기" value={s.size || 'medium'} onChange={(value) => set({ size: value })} options={SIZES} />
    <ToggleRow label="굵게" checked={Boolean(s.bold)} onChange={(value) => set({ bold: value })} />
    <ToggleRow label="밑줄" checked={Boolean(s.underline)} onChange={(value) => set({ underline: value })} />
    <WidgetSurfaceControls s={s} set={set} />
  </>;
}

export function CardsStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="배치" value={s.layout || 'grid'} onChange={(value) => set({ layout: value })} options={[{ value: 'grid', label: '격자' }, { value: 'stack', label: '목록' }, { value: 'steps', label: '순서' }]} />
    <SegmentedControl label="표현" value={s.tone || 'soft'} onChange={(value) => set({ tone: value })} options={[{ value: 'soft', label: '소프트' }, { value: 'solid', label: '채움' }, { value: 'outline', label: '라인' }]} />
    {(s.layout || 'grid') === 'grid' && <SegmentedControl label="열 개수" value={String(s.columns || 2)} onChange={(value) => set({ columns: Number(value) })} options={[{ value: '1', label: '1열' }, { value: '2', label: '2열' }]} />}
    <WidgetSurfaceControls s={s} set={set} alignOptions={ALIGN_NO_RIGHT} showBackground={false} showShadow={false} />
  </>;
}

export function LinksStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="배치" value={s.layout || 'list'} onChange={(value) => set({ layout: value })} options={[{ value: 'list', label: '목록' }, { value: 'card', label: '카드' }, { value: 'carousel', label: '슬라이드' }]} />
    <WidgetSurfaceControls s={s} set={set} />
  </>;
}

export function DownloadStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="배치" value={s.layout || 'card'} onChange={(value) => set({ layout: value })} options={[{ value: 'card', label: '카드' }, { value: 'list', label: '목록' }]} />
    <WidgetSurfaceControls s={s} set={set} />
  </>;
}

export function ScheduleStylePanel({ s, set }) {
  return <>
    <Color label="강조색" value={s.highlightColor || '#8AA2C8'} onChange={(value) => set({ highlightColor: value })} />
    <Color label="카드 배경" value={s.cardBgColor || '#FFFFFF'} onChange={(value) => set({ cardBgColor: value })} />
    <Color label="글자색" value={s.textColor || '#111827'} onChange={(value) => set({ textColor: value })} />
    <WidgetSurfaceControls s={s} set={set} defaultAlign="center" showBackground={false} showShadow={false} />
  </>;
}

export function TimerStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="테마" value={s.timerTheme || 'modern'} onChange={(value) => set({ timerTheme: value })} options={[{ value: 'modern', label: '모던' }, { value: 'glass', label: '글라스' }, { value: 'minimal', label: '미니멀' }, { value: 'accent', label: '강조' }]} />
    <SegmentedControl label="마감 효과" value={s.urgentStyle || 'flip'} onChange={(value) => set({ urgentStyle: value })} options={[{ value: 'flip', label: '플립' }, { value: 'line', label: '라인' }, { value: 'flow', label: '흐름' }, { value: 'none', label: '없음' }]} />
    <WidgetSurfaceControls s={s} set={set} align={false} showBackground={false} showShadow={false} />
  </>;
}

export function ActivityStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="테마" value={s.style || 'glass'} onChange={(value) => set({ style: value })} options={[{ value: 'minimal', label: '미니멀' }, { value: 'glass', label: '글라스' }, { value: 'dark', label: '다크' }]} />
    <SegmentedControl label="움직임" value={s.animation || 'stack'} onChange={(value) => set({ animation: value })} options={[{ value: 'stack', label: '쌓기' }, { value: 'none', label: '없음' }]} />
    <WidgetSurfaceControls s={s} set={set} align={false} showBackground={false} showShadow={false} />
  </>;
}

export function MapStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="지도 높이" value={s.height || 'medium'} onChange={(value) => set({ height: value })} options={SIZES} />
    <WidgetSurfaceControls s={s} set={set} align={false} showBackground={false} showShadow={false} />
  </>;
}

export function FaqStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="형태" value={s.layout || 'card'} onChange={(value) => set({ layout: value })} options={[{ value: 'accordion', label: '접기' }, { value: 'card', label: '카드' }, { value: 'plain', label: '기본' }]} />
    <WidgetSurfaceControls s={s} set={set} align={false} showBackground={false} showShadow={false} />
  </>;
}

export function SearchStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="형태" value={s.layout || 'card'} onChange={(value) => set({ layout: value })} options={[{ value: 'card', label: '카드' }, { value: 'bar', label: '바' }, { value: 'minimal', label: '심플' }]} />
    <WidgetSurfaceControls s={s} set={set} align={false} showBackground={false} showShadow={false} />
  </>;
}

export function CodeStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="영역 높이" value={s.height || 'auto'} onChange={(value) => set({ height: value })} options={[{ value: 'auto', label: '자동' }, ...SIZES]} />
    <WidgetSurfaceControls s={s} set={set} align={false} showBackground={false} showShadow={false} />
  </>;
}

export function TopNavStylePanel({ s, set }) {
  return <div className="editor-v2-control-list">
    <SegmentedControl label="배경" value={s.bg || 'white'} onChange={(value) => set({ bg: value })} options={[{ value: 'white', label: '밝게' }, { value: 'transparent', label: '투명' }, { value: 'dark', label: '어둡게' }]} />
    <SegmentedControl label="정렬" value={s.align || 'left'} onChange={(value) => set({ align: value })} options={ALIGN} />
    <SegmentedControl label="로고 크기" value={s.logoSize || 'medium'} onChange={(value) => set({ logoSize: value })} options={SIZES} />
    <SegmentedControl label="메뉴 형태" value={s.menuStyle || 'pill'} onChange={(value) => set({ menuStyle: value })} options={[{ value: 'pill', label: '캡슐' }, { value: 'text', label: '텍스트' }, { value: 'outline', label: '라인' }]} />
    <ToggleRow label="상단 고정" checked={s.sticky !== false} onChange={(value) => set({ sticky: value })} />
  </div>;
}

export function FooterStylePanel({ s, set }) {
  return <div className="editor-v2-control-list">
    <SegmentedControl label="정렬" value={s.align || 'center'} onChange={(value) => set({ align: value })} options={ALIGN} />
    <SegmentedControl label="배경" value={s.bg || 'plain'} onChange={(value) => set({ bg: value })} options={[{ value: 'plain', label: '기본' }, { value: 'soft', label: '소프트' }, { value: 'dark', label: '다크' }]} />
  </div>;
}

export function BottomBarStylePanel({ s, set }) {
  const colorMode = s.buttonColorMode || 'theme';
  return <div className="editor-v2-control-list">
    <SegmentedControl label="형태" value={s.style || 'pill'} onChange={(value) => set({ style: value })} options={[{ value: 'pill', label: '캡슐' }, { value: 'box', label: '박스' }]} />
    <SegmentedControl label="색상 방식" value={colorMode} onChange={(value) => set({ buttonColorMode: value })} options={[{ value: 'theme', label: '프리셋' }, { value: 'custom', label: '직접 지정' }]} />
    {colorMode === 'theme' ? (
      <SegmentedControl label="프리셋" value={s.color || 'dark'} onChange={(value) => set({ color: value })} options={[{ value: 'dark', label: '다크' }, { value: 'accent', label: '강조' }, { value: 'light', label: '라이트' }]} />
    ) : (
      <>
        <Color label="버튼 배경" value={s.buttonColor || '#111827'} onChange={(value) => set({ buttonColor: value })} />
        <Color label="버튼 글자" value={s.buttonTextColor || '#FFFFFF'} onChange={(value) => set({ buttonTextColor: value })} />
      </>
    )}
  </div>;
}

export { WidgetSurfaceControls };
