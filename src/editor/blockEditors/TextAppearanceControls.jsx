import { Color } from '../controls.jsx';
import { SegmentedControl, NumberControl } from '../ui/index.js';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
const ALIGN = [{value:'left',label:'왼쪽',icon:AlignLeft},{value:'center',label:'가운데',icon:AlignCenter},{value:'right',label:'오른쪽',icon:AlignRight}];

export function TextStylePanel({ s, set }) {
  return <>
    <SegmentedControl label="형태" value={s.layout || 'plain'} onChange={(value) => set({ layout: value })} options={[{ value: 'plain', label: '기본' }, { value: 'card', label: '카드' }, { value: 'notice', label: '강조' }]} />
    <SegmentedControl label="정렬" value={s.align || 'left'} onChange={(align) => set({ align })} options={ALIGN} />
    <NumberControl label="제목 크기" value={s.titleFontSizePx ?? ({ small: 20, medium: 24, large: 30 }[s.size] || 24)} min={12} max={72} unit="px" slider={false} steppers onChange={(titleFontSizePx) => set({ titleFontSizePx })} />
    <NumberControl label="본문 크기" value={s.bodyFontSizePx ?? ({ small: 13, medium: 15, large: 17 }[s.size] || 15)} min={10} max={48} unit="px" slider={false} steppers onChange={(bodyFontSizePx) => set({ bodyFontSizePx })} />
    <Color label="글자색" value={s.textColor || '#111827'} onChange={(textColor) => set({ textColor })} />
    <SegmentedControl label="배경" value={s.bgEnabled ? 'custom' : 'none'} onChange={(value) => set({ bgEnabled: value === 'custom' })} options={[{ value: 'none', label: '없음' }, { value: 'custom', label: '직접 지정' }]} />
    {s.bgEnabled && <Color label="배경색" value={s.bgColor || '#ffffff'} onChange={(bgColor) => set({ bgColor })} />}
  </>;
}
