import { useEffect, useRef, useState } from 'react';

export function RenderImage({ block }) {
  const s = block.s || {};
  const gallery = s.gallery || [];
  const [idx, setIdx] = useState(0);
  const [failedSrc, setFailedSrc] = useState('');
  const swipeRef = useRef(null);

  useEffect(() => {
    if (s.mode !== 'gallery' || !s.autoplay || gallery.length < 2) return;
    const timer = setInterval(() => setIdx((value) => (value + 1) % gallery.length), Number(s.interval || 5) * 1000);
    return () => clearInterval(timer);
  }, [s.mode, s.autoplay, s.interval, gallery.length]);

  useEffect(() => {
    if (s.mode !== 'gallery') return;
    if (idx > Math.max(0, gallery.length - 1)) setIdx(0);
  }, [s.mode, gallery.length, idx]);

  const rawSrc = s.mode === 'gallery' ? gallery[idx] : s.image;
  const fallbackSrc = s.imageFallback || '';
  const src = rawSrc && rawSrc !== failedSrc ? rawSrc : fallbackSrc;
  const display = s.imageDisplay || 'original';
  const style = display === 'fill'
    ? { height: `${Number(s.imageHeightPx || 260)}px` }
    : undefined;
  const imgStyle = display === 'fill'
    ? { objectPosition: `${Number(s.imageX ?? 50)}% ${Number(s.imageY ?? 50)}%` }
    : undefined;

  const moveGallery = (direction) => {
    if (s.mode !== 'gallery' || gallery.length < 2) return;
    setIdx((current) => {
      if (direction === 'next') return (current + 1) % gallery.length;
      return (current - 1 + gallery.length) % gallery.length;
    });
  };

  const onSwipeStart = (event) => {
    if (s.mode !== 'gallery' || gallery.length < 2) return;
    swipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onSwipeEnd = (event) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || s.mode !== 'gallery' || gallery.length < 2) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 42 || absX < absY * 1.2) return;

    if (dx < 0) moveGallery('next');
    else moveGallery('prev');
  };

  const blockStyle = {
    '--block-margin': `${Math.max(0, Math.min(48, Number(s.marginY ?? 12)))}px`,
  };

  return (
    <section id={`block-${block.id}`} className="landing-section image-sec" style={blockStyle}>
      {src ? (
        <div
          data-crop-block={block.id}
          className={`image-wrap image-${display} ${s.mode === 'gallery' && gallery.length > 1 ? 'is-swipeable' : ''} ${s.rounded ? 'rounded' : ''}`}
          style={style}
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => { swipeRef.current = null; }}
        >
          <img
            src={src}
            alt=""
            style={imgStyle}
            draggable="false"
            onError={() => {
              if (src && src !== fallbackSrc) setFailedSrc(src);
            }}
          />
          {s.mode === 'gallery' && gallery.length > 1 && (
            <>
              {(s.galleryShowArrows ?? true) && (
                <div className="gallery-arrows">
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveGallery('prev'); }} aria-label="이전 이미지">‹</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveGallery('next'); }} aria-label="다음 이미지">›</button>
                </div>
              )}
              {(s.galleryShowDots ?? true) && (
                <div className="dots">
                  {gallery.map((_, index) => (
                    <button
                      key={index}
                      className={idx === index ? 'active' : ''}
                      onClick={(event) => { event.stopPropagation(); setIdx(index); }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="image-placeholder">이미지를 업로드하세요</div>
      )}
      {s.caption && <p className="caption">{s.caption}</p>}
    </section>
  );
}
