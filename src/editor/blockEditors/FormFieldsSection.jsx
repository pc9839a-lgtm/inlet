import FormQuestionEmptyState from './FormQuestionEmptyState.jsx';
import FormQuestionList from './FormQuestionList.jsx';
import FormQuestionQuickAdd from './FormQuestionQuickAdd.jsx';

export default function FormFieldsSection({
  questions,
  openQuestionId,
  focusOnCreateQuestionId,
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
      <h3>받을 질문 <span>{questions.length}개</span></h3>
      <FormQuestionQuickAdd onAdd={onAdd} />
      <FormQuestionList
        questions={questions}
        openQuestionId={openQuestionId}
        focusOnCreateQuestionId={focusOnCreateQuestionId}
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
    </section>
  );
}
