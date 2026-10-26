import { Field } from '../controls.jsx';
import { FormOptionEditor } from './FormOptionEditor.jsx';
import { T } from './formEditorModel.js';
import FormQuestionMoveActions from './FormQuestionMoveActions.jsx';
import FormQuestionTypeRow from './FormQuestionTypeRow.jsx';

export default function FormQuestionBody({ question, index, total, onUpdate, onMove, onDuplicate, onRemove }) {
  return (
    <div className="form-question-body" id={`form-question-body-${question.id}`}>
      <Field label={T.item} value={question.label} onChange={(v) => onUpdate({ label: v })} />
      <FormQuestionTypeRow question={question} onUpdate={onUpdate} />
      <Field label={T.placeholder} value={question.placeholder || ''} onChange={(v) => onUpdate({ placeholder: v })} />
      {['select', 'multi'].includes(question.type) && (
        <FormOptionEditor options={question.options || []} onChange={(options) => onUpdate({ options })} />
      )}
      <FormQuestionMoveActions index={index} total={total} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
    </div>
  );
}
