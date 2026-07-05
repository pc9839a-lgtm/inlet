export default function ImageCropSlider({ draft, setDraft }) {
  return (
    <label className="crop-slider">
      <span>높이</span>
      <input
        type="range"
        min="140"
        max="520"
        step="10"
        value={draft.height}
        onChange={(event) => setDraft((prev) => ({ ...prev, height: Number(event.target.value) }))}
      />
      <b>{draft.height}px</b>
    </label>
  );
}