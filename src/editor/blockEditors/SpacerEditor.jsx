import { MoveVertical } from 'lucide-react';
import { EditorSection, SegmentedControl } from '../ui/index.js';

const preset = (height) => height <= 24 ? 'small' : height >= 80 ? 'large' : 'medium';
const heights = { small: 16, medium: 40, large: 96 };

export default function SpacerEditor({ s, set }) {
  const height = Number(s.height ?? 40);

  return (
    <EditorSection id="design" title="여백 크기" description="화면 사이의 빈 공간을 조정합니다." icon={MoveVertical} defaultOpen>
      <SegmentedControl label="크기" value={preset(height)} onChange={(value) => set({ height: heights[value] })} options={[{ value: 'small', label: '작게' }, { value: 'medium', label: '보통' }, { value: 'large', label: '크게' }]} />
      <div className="spacer-editor-card">
        <span>직접 조정</span>
        <input type="range" min="8" max="200" step="4" value={height} onChange={(event) => set({ height: Number(event.target.value) })} />
        <b>{height}px</b>
      </div>
    </EditorSection>
  );
}