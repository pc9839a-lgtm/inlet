import { quickQuestionTypes } from './formEditorModel.js';

export default function FormQuestionQuickAdd({ onAdd }) {
  return (
    <div className="form-question-tools inlet-question-tools">
      {quickQuestionTypes.map(([type, label]) => (
        <button type="button" key={type} onClick={() => onAdd(type)}>+ {label}</button>
      ))}
    </div>
  );
}
