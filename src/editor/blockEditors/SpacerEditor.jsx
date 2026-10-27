import { NumberControl } from '../ui/NumberControl.jsx';

export default function SpacerEditor({ s, set }) {
  const height = Number(s.height ?? 40);

  return (
    <div className="editor-v2-control-list layout-editor-direct-flow" aria-label="여백 설정">
      <NumberControl
        label="여백 높이"
        value={height}
        min={8}
        max={200}
        step={4}
        unit="px"
        slider={false}
        onChange={(height) => set({ height })}
      />
    </div>
  );
}
