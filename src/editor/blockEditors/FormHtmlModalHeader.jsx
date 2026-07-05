export default function FormHtmlModalHeader({ title, description, closeLabel, onClose }) {
  return (
    <div className="inlet-html-head">
      <div>
        <strong id="inlet-html-modal-title">{title}</strong>
        <span>{description}</span>
      </div>
      <button type="button" onClick={onClose} aria-label={closeLabel}>x</button>
    </div>
  );
}