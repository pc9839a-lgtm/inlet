import { EditorTabs, NumberControl } from '../ui/index.js';

export default function SpacerEditor({ s, set }) {
  const height = Number(s.height ?? 40);

  return (
    <EditorTabs
      tabs={[{
        id: 'design',
        label: '스타일',
        content: (
          <NumberControl label="여백 높이" value={height} min={8} max={200} step={4} unit="px" presets={[8, 16, 24, 40, 80]} onChange={(height) => set({ height })} />
        ),
      }]}
    />
  );
}
