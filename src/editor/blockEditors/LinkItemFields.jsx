import { EditorField } from '../ui/index.js';
import { LinkIconPicker } from './LinkIconPicker.jsx';

export default function LinkItemFields({ item, index, page, TargetControl, onUpdate }) {
  return (
    <div className="link-editor-panel-v3">
      <EditorField label="버튼 문구">
        <input aria-label={`링크 ${index + 1} 이름`} data-link-item-label-index={index} value={item.label || ''} onChange={(event) => onUpdate({ label: event.target.value })} />
      </EditorField>

      <TargetControl
        label="누르면"
        target={item.target || 'url'}
        url={item.url}
        lastWidgetTarget={item.lastWidgetTarget}
        lastUrl={item.lastUrl}
        lastPhoneUrl={item.lastPhoneUrl}
        page={page}
        onChange={onUpdate}
      />

      <div className="link-visual-control-v3 link-secondary-appearance">
        <span className="link-control-label-v3">표시</span>
        <LinkIconPicker item={item} onChange={onUpdate} />
      </div>
    </div>
  );
}
