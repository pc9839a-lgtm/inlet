export default function FormHtmlModalActions({ showCode, labels, onToggleCode, onClose, onCopy }) {
  return (
    <div className="inlet-html-actions">
      <button type="button" onClick={onToggleCode}>{showCode ? labels.hideCode : labels.showCode}</button>
      <button type="button" onClick={onClose}>{labels.close}</button>
      <button type="button" className="primary" onClick={onCopy}>{labels.copy}</button>
    </div>
  );
}