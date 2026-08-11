import { EditorField } from '../ui/index.js';
import { LinkIconPicker } from './LinkIconPicker.jsx';

export default function LinkItemFields({ item, page, TargetControl, onUpdate }) {
  return (
    <div className="link-editor-panel-v3">
      <EditorField label="이름">
        <input value={item.label || ''} onChange={(event) => onUpdate({ label: event.target.value })} />
      </EditorField>

      <TargetControl
        label="이동"
        target={item.target || 'url'}
        url={item.url}
        lastWidgetTarget={item.lastWidgetTarget}
        page={page}
        onChange={onUpdate}
      />

      <div className="link-visual-control-v3">
        <span className="link-control-label-v3">표시</span>
        <LinkIconPicker item={item} onChange={onUpdate} />
      </div>
    </div>
  );
}
