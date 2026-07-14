import { ImageCropModal } from './ImageCropModal.jsx';
import { SegmentedControl, ToggleRow } from '../ui/index.js';

export default function ImageDisplayControls({ display, s, set, editSrc, blockId, cropOpen, setCropOpen, changeDisplay }) {
  return (
    <div className="image-edit-attached editor-v2-control-list">
      <SegmentedControl
        label="표시 방식"
        value={display}
        onChange={changeDisplay}
        options={[
          { value: 'original', label: '원본' },
          { value: 'fill', label: '채우기' },
        ]}
      />
      <ToggleRow label="모서리 둥글게" checked={Boolean(s.rounded)} onChange={(value) => set({ rounded: value })} />

      {display === 'fill' && (
        <button type="button" className="crop-open-button" onClick={() => setCropOpen(true)}>위치·높이 조정</button>
      )}
      {cropOpen && <ImageCropModal src={editSrc} s={s} set={set} blockId={blockId} onClose={() => setCropOpen(false)} />}
    </div>
  );
}