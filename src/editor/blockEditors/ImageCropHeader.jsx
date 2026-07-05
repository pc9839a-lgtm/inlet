export default function ImageCropHeader({ onClose }) {
  return (
    <div className="crop-modal-head">
      <div>
        <strong>이미지 자르기</strong>
        <span>높이를 정하고 이미지를 드래그해서 보이는 위치를 맞추세요.</span>
      </div>
      <button type="button" onClick={onClose} aria-label="닫기">×</button>
    </div>
  );
}