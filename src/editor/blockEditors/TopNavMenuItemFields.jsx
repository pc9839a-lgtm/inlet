import { EditorField } from '../ui/index.js';

const MENU_NAME_LABEL = '\uBA54\uB274\uBA85';

export default function TopNavMenuItemFields({ menu, page, TargetControl, onChange }) {
  return (
    <div className="mini-body topnav-menu-editor-body">
      <EditorField label={MENU_NAME_LABEL}>
        <input value={menu.label || ''} onChange={(event) => onChange({ label: event.target.value })} />
      </EditorField>
      <TargetControl
        target={menu.target}
        url={menu.url}
        lastWidgetTarget={menu.lastWidgetTarget}
        page={page}
        onChange={onChange}
      />
    </div>
  );
}
