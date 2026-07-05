import { AddButton } from '../controls.jsx';
import { T } from './formEditorModel.js';

export function FormOptionEditor({ options = [], onChange }) {
  const list = options.length ? options : [T.optional + ' 1', T.optional + ' 2'];
  const update = (idx, value) => onChange(list.map((item, i) => (i === idx ? value : item)).filter((item) => String(item).trim()));
  const remove = (idx) => onChange(list.filter((_, i) => i !== idx));

  return (
    <div className="option-editor">
      <span>{T.options}</span>
      {list.map((option, idx) => (
        <div key={idx}>
          <input value={option} onChange={(e) => update(idx, e.target.value)} />
          <button type="button" onClick={() => remove(idx)}>{T.remove}</button>
        </div>
      ))}
      <AddButton onClick={() => onChange([...list, T.optional + ' ' + (list.length + 1)])} />
    </div>
  );
}
