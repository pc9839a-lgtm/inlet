export default function GalleryUploadButton({ count, max, disabled, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}>
      <span>＋</span>
      <b>여러 장 추가</b>
      <small>{count}/{max}</small>
    </button>
  );
}