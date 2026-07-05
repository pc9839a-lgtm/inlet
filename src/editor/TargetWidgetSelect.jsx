import { META } from '../config/blockMeta.jsx';
import { TARGET_LABELS } from './targetControlModel.js';

export function TargetWidgetSelect({ blocks, currentWidget, onChange }) {
  return (
    <label className="field field-option target-field">
      <span>{TARGET_LABELS.moveWidget}</span>
      <select value={currentWidget} onChange={(event) => onChange(event.target.value)}>
        {blocks.map((block, index) => {
          const meta = META[block.type] || META.text;
          return <option key={block.id} value={`block:${block.id}`}>{index + 1}. {meta.label} #{block.s?.anchorId || block.type}</option>;
        })}
      </select>
    </label>
  );
}
