import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { formQuestionOptions } from '../editorOptions.js';

export default function FormQuestionQuickAdd({ onAdd }) {
  const ref = useRef(null);
  const add = (type) => {
    onAdd(type);
    if (ref.current) {
      ref.current.open = false;
    }
  };
  return (
    <div className="form-question-add-actions">
      <button type="button" className="form-question-add-primary" onClick={() => add('short')}>
        <Plus size={16} aria-hidden="true" />
        질문 추가
      </button>
      <details className="form-question-add" ref={ref} onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus({ preventScroll: true });
      }}>
        <summary>다른 유형</summary>
        <div className="form-question-tools">
          {formQuestionOptions.map(([type, label]) => (
            <button type="button" key={type} onClick={() => add(type)}>{label}</button>
          ))}
        </div>
      </details>
    </div>
  );
}
