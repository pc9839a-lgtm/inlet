import FormQuestionBody from './FormQuestionBody.jsx';
import FormQuestionHeader from './FormQuestionHeader.jsx';

export default function FormQuestionCard({
  question,
  index,
  total,
  isOpen,
  isDragging,
  isDragOver,
  onToggleOpen,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`form-question-card ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
    >
      <FormQuestionHeader
        question={question}
        index={index}
        isOpen={isOpen}
        onToggleOpen={onToggleOpen}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />

      {isOpen && (
        <FormQuestionBody
          question={question}
          index={index}
          total={total}
          onUpdate={onUpdate}
          onMove={onMove}
        />
      )}
    </div>
  );
}