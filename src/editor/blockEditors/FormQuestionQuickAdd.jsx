import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { formQuestionOptions } from '../editorOptions.js';

export default function FormQuestionQuickAdd({ onAdd }) {
  const ref = useRef(null);
  const add = (type) => {
    onAdd(type);
    ref.current.open = false;
    ref.current.querySelector('summary')?.focus({ preventScroll: true });
  };
  return (
    <details className="form-question-add" ref={ref} onKeyDown={(event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      ref.current.open = false;
      ref.current.querySelector('summary')?.focus({ preventScroll: true });
    }}>
      <summary><Plus size={16} aria-hidden="true" />항목 추가</summary>
      <div className="form-question-tools">
        {formQuestionOptions.map(([type, label]) => (
          <button type="button" key={type} onClick={() => add(type)}>{label}</button>
        ))}
      </div>
    </details>
  );
}
