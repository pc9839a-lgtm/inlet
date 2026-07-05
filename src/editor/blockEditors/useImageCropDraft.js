import { useEffect, useState } from 'react';

const defaultCrop = { height: 260, x: 50, y: 50 };

function toDraft(s) {
  return {
    height: Number(s.imageHeightPx || defaultCrop.height),
    x: Number(s.imageX ?? defaultCrop.x),
    y: Number(s.imageY ?? defaultCrop.y),
  };
}

export function useImageCropDraft(src, s) {
  const [draft, setDraft] = useState(toDraft(s));

  useEffect(() => {
    setDraft(toDraft(s));
  }, [src, s.imageHeightPx, s.imageX, s.imageY]);

  const resetDraft = () => setDraft(defaultCrop);

  return { draft, setDraft, resetDraft };
}