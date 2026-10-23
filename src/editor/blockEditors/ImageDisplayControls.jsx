import { ImageCropModal } from './ImageCropModal.jsx';
import { SegmentedControl, ToggleRow, NumberControl } from '../ui/index.js';
import { WidgetSpacingControls } from './WidgetSpacingControls.jsx';

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
      {display === 'fill' && <NumberControl label="이미지 높이" value={s.imageHeightPx ?? 260} unit="px" min={140} max={520} step={10} onChange={(imageHeightPx) => set({ imageHeightPx })} />}

      {display === 'fill' && (
        <button type="button" className="crop-open-button" onClick={() => setCropOpen(true)}>위치·높이 조정</button>
      )}
      {cropOpen && <ImageCropModal src={editSrc} s={s} set={set} blockId={blockId} onClose={() => setCropOpen(false)} />}
      <WidgetSpacingControls s={s} set={set} padding={false} defaultMargin={12} />
    </div>
  );
}
