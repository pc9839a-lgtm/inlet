import { NumberControl } from '../ui/NumberControl.jsx';

export default function ImageCropSlider({ draft, setDraft }) {
  return (
    <div className="crop-slider"><NumberControl label="높이" unit="px" min={140} max={520} step={10} value={draft.height} onChange={(height) => setDraft((prev) => ({ ...prev, height }))} /></div>
  );
}
