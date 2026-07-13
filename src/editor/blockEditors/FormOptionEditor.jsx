import { Plus, Trash2 } from 'lucide-react';
import { T } from './formEditorModel.js';

export function FormOptionEditor({ options = [], onChange }) {
  const list = options.length ? options : [`${T.optional} 1`, `${T.optional} 2`];
  const update = (index, value) => {
    onChange(list.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };
  const remove = (index) => {
    if (list.length <= 1) return;
    onChange(list.filter((_, itemIndex) => itemIndex !== index));
  };
  const add = () => {
    onChange([...list, `${T.optional} ${list.length + 1}`]);
  };

  return (
    <div className="option-editor">
      <span className="option-editor-heading">
        <strong>{T.options}</strong>
        <em>{list.length}개</em>
      </span>
      {list.map((option, index) => (
        <div className="option-editor-row" key={index}>
          <span className="option-editor-index" aria-hidden="true">{index + 1}</span>
          <input
            aria-label={`${T.options} ${index + 1}`}
            value={option}
            onChange={(event) => update(index, event.target.value)}
          />
          <button
            type="button"
            className="option-editor-remove"
            aria-label={`${T.options} ${index + 1} ${T.remove}`}
            title={list.length <= 1 ? '선택지는 하나 이상 필요합니다.' : T.remove}
            disabled={list.length <= 1}
            onClick={() => remove(index)}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="option-editor-add" onClick={add}>
        <Plus size={16} aria-hidden="true" />
        <span>선택지 추가</span>
      </button>
    </div>
  );
}
