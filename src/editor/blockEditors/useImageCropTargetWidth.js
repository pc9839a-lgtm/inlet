import { useEffect, useState } from 'react';

export function useImageCropTargetWidth(blockId, src) {
  const [targetWidth, setTargetWidth] = useState(360);

  useEffect(() => {
    const measure = () => {
      const target = blockId ? document.querySelector(`[data-crop-block="${blockId}"]`) : null;
      const width = target?.getBoundingClientRect?.().width;
      if (width && width > 120) setTargetWidth(Math.round(width));
    };

    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [blockId, src]);

  return targetWidth;
}