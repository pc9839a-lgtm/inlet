import { EditorStack, Step } from '../controls.jsx';

export default function DividerEditor({ s, set }) {
  const width = Number(s.width ?? 100);
  const thickness = Number(s.thickness ?? 1);

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <div className="spacer-editor-card">
          <span>길이</span>
          <input type="range" min="10" max="100" step="5" value={width} onChange={(e) => set({ width: Number(e.target.value) })} />
          <b>{width}%</b>
        </div>
        <div className="spacer-editor-card">
          <span>두께</span>
          <input type="range" min="1" max="8" step="1" value={thickness} onChange={(e) => set({ thickness: Number(e.target.value) })} />
          <b>{thickness}px</b>
        </div>
      </Step>
    </EditorStack>
  );
}
