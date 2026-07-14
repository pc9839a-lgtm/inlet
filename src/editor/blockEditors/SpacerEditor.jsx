import { EditorTabs } from '../ui/index.js';

export default function SpacerEditor({ s, set }) {
  const height = Number(s.height ?? 40);

  return (
    <EditorTabs
      tabs={[{
        id: 'design',
        label: '스타일',
        content: (
          <div className="spacer-editor-card">
            <span>여백 높이</span>
            <input type="range" min="8" max="200" step="4" value={height} onChange={(event) => set({ height: Number(event.target.value) })} />
            <b>{height}px</b>
          </div>
        ),
      }]}
    />
  );
}