import { META } from '../config/blockMeta.jsx';
import { TARGET_LABELS, isValidWidgetTarget } from './targetControlModel.js';

export function TargetWidgetSelect({ blocks, currentWidget, onChange }) {
  const invalid = !isValidWidgetTarget(currentWidget, blocks);
  return (
    <div className="target-widget-control">
      <label className="field field-option target-field">
        <span>{TARGET_LABELS.moveWidget}</span>
        <select value={currentWidget} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)}>
          {invalid && (
            <option value={currentWidget} disabled>
              {currentWidget ? '삭제되었거나 잘못된 이동 대상' : '이동 대상을 선택하세요'}
            </option>
          )}
          {blocks.map((block, index) => {
            const meta = META[block.type] || META.text;
            return <option key={block.id} value={`block:${block.id}`}>{index + 1}. {meta.label} #{block.s?.anchorId || block.type}</option>;
          })}
        </select>
      </label>
      {invalid && <p role="alert">이동할 위젯을 다시 선택해야 합니다.</p>}
    </div>
  );
}
