import { EditorField } from '../ui/index.js';
import { LinkIconPicker } from './LinkIconPicker.jsx';

export default function LinkItemFields({ item, page, TargetControl, onUpdate }) {
  return (
    <div className="link-editor-simple editor-v2-control-list">
      <EditorField label="이름" description="방문자에게 표시할 버튼 이름입니다.">
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
      <LinkIconPicker item={item} onChange={onUpdate} />
    </div>
  );
}