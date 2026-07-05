import ReservationCustomFieldBody from './ReservationCustomFieldBody.jsx';
import ReservationCustomFieldHeader from './ReservationCustomFieldHeader.jsx';

export default function ReservationCustomFieldCard({
  field,
  index,
  isDragging,
  isDragOver,
  optionDraft,
  onUpdate,
  onUpdateOptions,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  return (
    <div
      className={`form-question-card reservation-custom-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <ReservationCustomFieldHeader
        index={index}
        label={field.label}
        onRemove={onRemove}
      />
      <ReservationCustomFieldBody
        field={field}
        optionDraft={optionDraft}
        onUpdate={onUpdate}
        onUpdateOptions={onUpdateOptions}
      />
    </div>
  );
}