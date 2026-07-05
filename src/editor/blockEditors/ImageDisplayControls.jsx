import { ImageCropModal } from './ImageCropModal.jsx';

export default function ImageDisplayControls({ display, s, set, editSrc, blockId, cropOpen, setCropOpen, changeDisplay }) {
  return (
    <div className="image-edit-attached">
      <div className="image-mode-toolbar">
        <button type="button" className={display === 'original' ? 'active' : ''} onClick={() => changeDisplay('original')} title="원본 비율">
          <span>↔</span>
          <b>원본 비율</b>
        </button>
        <button type="button" className={display === 'fill' ? 'active' : ''} onClick={() => changeDisplay('fill')} title="채우기">
          <span>▣</span>
          <b>채우기</b>
        </button>
        <button type="button" className={s.rounded ? 'active' : ''} onClick={() => set({ rounded: !s.rounded })} title="모서리">
          <span>◜</span>
          <b>둥글게</b>
        </button>
      </div>

      {display === 'original' ? (
        <div className="image-mode-note compact">원본 비율 그대로 가로 100%에 맞춰 표시합니다.</div>
      ) : (
        <>
          <button type="button" className="crop-open-button" onClick={() => setCropOpen(true)}>화면 조정</button>
          {s.mode === 'gallery' && <div className="image-mode-note compact">갤러리 화면 조정은 모든 이미지에 공통 적용됩니다.</div>}
        </>
      )}

      {cropOpen && <ImageCropModal src={editSrc} s={s} set={set} blockId={blockId} onClose={() => setCropOpen(false)} />}
    </div>
  );
}