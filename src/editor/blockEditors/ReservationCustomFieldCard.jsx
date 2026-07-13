import ReservationCustomFieldBody from './ReservationCustomFieldBody.jsx';
import ReservationCustomFieldHeader from './ReservationCustomFieldHeader.jsx';

export default function ReservationCustomFieldCard({
  field,
  index,
  isOpen,
  isDragging,
  isDragOver,
  optionDraft,
  onUpdate,
  onUpdateOptions,
  onRemove,
  onToggleOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  return (
    <div
      className={`form-question-card reservation-custom-card ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <ReservationCustomFieldHeader
        field={field}
        index={index}
        isOpen={isOpen}
        onToggleOpen={onToggleOpen}
        onRemove={onRemove}
      />
      {isOpen && (
        <ReservationCustomFieldBody
          field={field}
          optionDraft={optionDraft}
          onUpdate={onUpdate}
          onUpdateOptions={onUpdateOptions}
        />
      )}
    </div>
  );
}
