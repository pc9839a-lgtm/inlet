import { Color } from '../controls.jsx';
import { EditorTabs, SegmentedControl } from '../ui/index.js';

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
            <div className="spacer-editor-card">
              <span>길이</span>
              <input type="range" min="10" max="100" step="5" value={width} onChange={(event) => set({ width: Number(event.target.value) })} />
              <b>{width}%</b>
            </div>
            <div className="spacer-editor-card">
              <span>두께</span>
              <input type="range" min="1" max="8" step="1" value={thickness} onChange={(event) => set({ thickness: Number(event.target.value) })} />
              <b>{thickness}px</b>
            </div>
            <div className="spacer-editor-card">
              <span>상하 간격</span>
              <input type="range" min="0" max="80" step="4" value={marginY} onChange={(event) => set({ marginY: Number(event.target.value) })} />
              <b>{marginY}px</b>
            </div>
            <Color label="선 색상" value={s.color || '#E2E8F0'} onChange={(value) => set({ color: value })} />
          </>
        ),
      }]}
    />
  );
}