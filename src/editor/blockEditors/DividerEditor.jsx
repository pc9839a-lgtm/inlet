import { Minus } from 'lucide-react';
import { EditorSection } from '../ui/index.js';

export default function DividerEditor({ s, set }) {
  const width = Number(s.width ?? 100);
  const thickness = Number(s.thickness ?? 1);

  return (
    <EditorSection id="design" title="구분선" description="구분선의 길이와 두께를 조정합니다." icon={Minus} defaultOpen>
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
    </EditorSection>
  );
}