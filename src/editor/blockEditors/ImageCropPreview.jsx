import { useRef } from 'react';

const clamp = (value) => Math.max(0, Math.min(100, value));

export default function ImageCropPreview({ src, draft, setDraft }) {
  const boxRef = useRef(null);

  const moveByPointer = (event) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100);
    setDraft((prev) => ({ ...prev, x, y }));
  };

  return (
    <div
      ref={boxRef}
      className="crop-preview"
      style={{ height: `${draft.height}px` }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        moveByPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        moveByPointer(event);
      }}
    >
      <img src={src} alt="" style={{ objectPosition: `${draft.x}% ${draft.y}%` }} draggable="false" />
      <span className="crop-guide">드래그로 위치 조정</span>
    </div>
  );
}