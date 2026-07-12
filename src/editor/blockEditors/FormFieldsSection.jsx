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
    <div className="editor-v2-control-list">
      <FormQuestionQuickAdd onAdd={onAdd} />
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
    </div>
  );
}