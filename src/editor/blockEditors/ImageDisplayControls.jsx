import { ImageCropModal } from './ImageCropModal.jsx';
import { SegmentedControl, NumberControl } from '../ui/index.js';

export default function ImageDisplayControls({ display, s, set, editSrc, blockId, cropOpen, setCropOpen, changeDisplay }) {
  return (
    <div className="image-display-controls editor-v2-control-list">
      <SegmentedControl
        label="맞춤"
        value={display}
        onChange={changeDisplay}
        options={[
          { value: 'original', label: '전체 보기' },
          { value: 'fill', label: '채우기' },
        ]}
      />
      {display === 'fill' && <NumberControl label="이미지 높이" value={s.imageHeightPx ?? 260} unit="px" min={140} max={520} step={10} slider={false} onChange={(imageHeightPx) => set({ imageHeightPx })} />}

      {display === 'fill' && (
        <button type="button" className="crop-open-button" disabled={!editSrc} onClick={() => setCropOpen(true)}>사진 위치 조정</button>
      )}
      {cropOpen && <ImageCropModal src={editSrc} s={s} set={set} blockId={blockId} onClose={() => setCropOpen(false)} />}
    </div>
  );
}
