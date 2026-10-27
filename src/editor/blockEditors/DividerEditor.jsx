import { Color } from '../controls.jsx';
import { SegmentedControl, NumberControl } from '../ui/index.js';

export default function DividerEditor({ s, set }) {
  const width = Number(s.width ?? 100);
  const thickness = Number(s.thickness ?? 1);
  const marginY = Number(s.marginY ?? 24);

  return (
    <div className="editor-v2-control-list layout-editor-direct-flow" aria-label="구분선 설정">
      <SegmentedControl
        label="선 모양"
        value={s.style || 'solid'}
        onChange={(style) => set({ style })}
        options={[{ value: 'solid', label: '실선' }, { value: 'dashed', label: '긴 점선' }, { value: 'dotted', label: '점선' }]}
      />
      <Color label="선 색상" value={s.color || '#E2E8F0'} onChange={(color) => set({ color })} />
      <NumberControl label="길이" value={width} min={10} max={100} step={5} unit="%" slider={false} onChange={(width) => set({ width })} />
      {width < 100 && (
        <SegmentedControl
          label="정렬"
          value={s.align || 'center'}
          onChange={(align) => set({ align })}
          options={[{ value: 'left', label: '왼쪽' }, { value: 'center', label: '가운데' }, { value: 'right', label: '오른쪽' }]}
        />
      )}
      <NumberControl label="두께" value={thickness} min={1} max={8} unit="px" slider={false} onChange={(thickness) => set({ thickness })} />
      <NumberControl label="위아래 간격" value={marginY} min={0} max={80} step={4} unit="px" slider={false} onChange={(marginY) => set({ marginY })} />
    </div>
  );
}
