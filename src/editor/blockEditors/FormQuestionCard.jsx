import { useEffect, useRef } from 'react';
import FormQuestionBody from './FormQuestionBody.jsx';
import FormQuestionHeader from './FormQuestionHeader.jsx';

export default function FormQuestionCard({
  question,
  index,
  total,
  isOpen,
  focusOnCreate = false,
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
  const ref = useRef(null);
  const pendingCreateFocus = useRef(isOpen && focusOnCreate);
  useEffect(() => {
    if (!pendingCreateFocus.current || !isOpen) return;
    const input = ref.current?.querySelector('.form-question-body input');
    if (!input) return;
    pendingCreateFocus.current = false;
    input.focus();
    input.select();
  }, [isOpen]);

  return (
    <div
      ref={ref}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`form-question-card ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      data-question-id={question.id}
    >
      <FormQuestionHeader
        question={question}
        index={index}
        isOpen={isOpen}
        onToggleOpen={onToggleOpen}
        onDragStart={onDragStart}
      />

      {isOpen && (
        <FormQuestionBody
          question={question}
          index={index}
          total={total}
          onUpdate={onUpdate}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
