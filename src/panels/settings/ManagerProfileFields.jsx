import { Field } from '../../editor/controls.jsx';

export default function ManagerProfileFields({ index, locked, manager, updateManager }) {
  return (
    <div className="settings-grid">
      <Field label={'\uC774\uB984'} value={manager.name} disabled={locked} onChange={(value) => updateManager(index, { name: value })} />
      <Field label={'\uC774\uBA54\uC77C'} value={manager.email} disabled={locked} onChange={(value) => updateManager(index, { email: value.trim().toLowerCase() })} />
    </div>
  );
}
