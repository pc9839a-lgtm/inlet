export default function LinkThumbPreview({ thumb }) {
  return (
    <div className="thumb-square">
      {thumb ? <img src={thumb} alt="" /> : <span>1:1</span>}
    </div>
  );
}