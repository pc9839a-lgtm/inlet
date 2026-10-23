import { Color } from '../controls.jsx';
import { EditorTabs, SegmentedControl, NumberControl } from '../ui/index.js';

export default function DividerEditor({ s, set }) {
  const width = Number(s.width ?? 100);
  const thickness = Number(s.thickness ?? 1);
  const marginY = Number(s.marginY ?? 24);

  return (
    <EditorTabs
      tabs={[{
        id: 'design',
        label: '스타일',
        content: (
          <>
            <SegmentedControl label="선 모양" value={s.style || 'solid'} onChange={(value) => set({ style: value })} options={[{ value: 'solid', label: '실선' }, { value: 'dashed', label: '긴 점선' }, { value: 'dotted', label: '점선' }]} />
            {width < 100 && (
              <SegmentedControl label="정렬" value={s.align || 'center'} onChange={(value) => set({ align: value })} options={[{ value: 'left', label: '왼쪽' }, { value: 'center', label: '가운데' }, { value: 'right', label: '오른쪽' }]} />
            )}
            <NumberControl label="길이" value={width} min={10} max={100} step={5} unit="%" onChange={(width) => set({ width })} />
            <NumberControl label="두께" value={thickness} min={1} max={8} unit="px" onChange={(thickness) => set({ thickness })} />
            <NumberControl label="상하 간격" value={marginY} min={0} max={80} step={4} unit="px" presets={[0, 8, 16, 24, 40]} onChange={(marginY) => set({ marginY })} />
            <Color label="선 색상" value={s.color || '#E2E8F0'} onChange={(value) => set({ color: value })} />
          </>
        ),
      }]}
    />
  );
}
