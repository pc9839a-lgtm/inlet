import { Field } from '../controls.jsx';

export default function TopNavMenuItemFields({ menu, page, TargetControl, onChange }) {
  return (
    <div className="mini-body">
      <Field label="메뉴명" value={menu.label} onChange={(label) => onChange({ label })} />
      <TargetControl
        label="이동"
        target={menu.target}
        url={menu.url}
        lastWidgetTarget={menu.lastWidgetTarget}
        page={page}
        onChange={onChange}
      />
    </div>
  );
}