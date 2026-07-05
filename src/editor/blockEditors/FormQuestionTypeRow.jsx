import { Toggle } from '../controls.jsx';
import { formQuestionOptions } from '../editorOptions.js';
import { T } from './formEditorModel.js';

export default function FormQuestionTypeRow({ question, onUpdate }) {
  const updateType = (type) => {
    onUpdate({
      type,
      options: ['select', 'multi'].includes(type)
        ? (question.options?.length ? question.options : [`${T.optional} 1`, `${T.optional} 2`])
        : [],
    });
  };

  return (
    <div className="question-compact-row">
      <label>
        <span>{T.fieldType}</span>
        <select value={question.type} onChange={(event) => updateType(event.target.value)}>
          {formQuestionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Toggle label={T.required} checked={!!question.required} onChange={(value) => onUpdate({ required: value })} />
    </div>
  );
}