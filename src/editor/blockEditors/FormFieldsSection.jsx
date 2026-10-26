import FormQuestionEmptyState from './FormQuestionEmptyState.jsx';
import FormQuestionList from './FormQuestionList.jsx';
import FormQuestionQuickAdd from './FormQuestionQuickAdd.jsx';

export default function FormFieldsSection({
  questions,
  openQuestionId,
  dragQuestionId,
  dragOverQuestionId,
  onAdd,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onToggleOpen,
  onMoveByDrag,
  onDragStart,
  onDragEnd,
  onDrop,
}) {
  return (
    <section className="form-fields-section" aria-label="입력 항목">
      <h3>입력 항목 <span>{questions.length}</span></h3>
      <FormQuestionList
        questions={questions}
        openQuestionId={openQuestionId}
        dragQuestionId={dragQuestionId}
        dragOverQuestionId={dragOverQuestionId}
        onToggleOpen={onToggleOpen}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onMove={onMove}
        onMoveByDrag={onMoveByDrag}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      />
      <FormQuestionEmptyState show={!questions.length} />
      <FormQuestionQuickAdd onAdd={onAdd} />
    </section>
  );
}
