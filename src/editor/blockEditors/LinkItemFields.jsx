import { Field } from '../controls.jsx';
import { LinkIconPicker } from './LinkIconPicker.jsx';

export default function LinkItemFields({ item, page, TargetControl, onUpdate }) {
  return (
    <div className="link-editor-simple">
      <Field label="이름" value={item.label} onChange={(value) => onUpdate({ label: value })} />
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