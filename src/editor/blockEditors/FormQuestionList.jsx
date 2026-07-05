import FormQuestionCard from './FormQuestionCard.jsx';

export default function FormQuestionList({
  questions,
  openQuestionId,
  dragQuestionId,
  dragOverQuestionId,
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
    <div className="form-question-list form-question-sortable">
      {questions.map((question, index) => (
        <FormQuestionCard
          key={question.id}
          question={question}
          index={index}
          total={questions.length}
          isOpen={openQuestionId === question.id}
          isDragging={dragQuestionId === question.id}
          isDragOver={dragOverQuestionId === question.id}
          onToggleOpen={() => onToggleOpen(question.id)}
          onUpdate={(patch) => onUpdate(question.id, patch)}
          onRemove={() => onRemove(question.id)}
          onDuplicate={() => onDuplicate(question)}
          onMove={(direction) => onMove(question.id, direction)}
          onDragStart={() => onDragStart(question.id)}
          onDragEnter={() => onMoveByDrag(question.id)}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}
