import { META } from '../../config/blockMeta.jsx';

export default function BottomWidgetTargetSelect({ blocks, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {blocks.map((block, idx) => {
        const meta = META[block.type] || META.text;
        return (
          <option key={block.id} value={`block:${block.id}`}>
            {idx + 1}. {meta.label}
          </option>
        );
      })}
    </select>
  );
}
