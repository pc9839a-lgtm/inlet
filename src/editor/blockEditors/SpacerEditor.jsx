import { EditorStack, Step } from '../controls.jsx';

export default function SpacerEditor({ s, set }) {
  const height = Number(s.height ?? 40);

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <div className="spacer-editor-card">
          <span>높이</span>
          <input type="range" min="8" max="200" step="4" value={height} onChange={(e) => set({ height: Number(e.target.value) })} />
          <b>{height}px</b>
        </div>
      </Step>
    </EditorStack>
  );
}
