import { META } from '../../config/blockMeta.jsx';
import { isValidWidgetTarget } from '../targetControlModel.js';

export default function BottomWidgetTargetSelect({ blocks, value, onChange }) {
  const invalid = !isValidWidgetTarget(value, blocks);
  return (
    <div className="bottom-widget-target-control">
      <select
        value={value}
        aria-label="이동할 위젯"
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      >
        {invalid && (
          <option value={value} disabled>
            {value ? '삭제되었거나 잘못된 이동 대상' : '이동 대상을 선택하세요'}
          </option>
        )}
        {blocks.map((block, idx) => {
          const meta = META[block.type] || META.text;
          return (
            <option key={block.id} value={`block:${block.id}`}>
              {idx + 1}. {meta.label}
            </option>
          );
        })}
      </select>
      {invalid && <p role="alert">이동할 위젯을 다시 선택해야 합니다.</p>}
    </div>
  );
}
