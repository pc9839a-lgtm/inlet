export default function FormHtmlModalNotice({ badge, description }) {
  return (
    <div className="inlet-code-notice">
      <b>{badge}</b>
      <p>{description}</p>
    </div>
  );
}