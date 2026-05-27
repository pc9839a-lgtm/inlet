import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AddButton,
  Choice,
  Danger,
  EditorStack,
  Field,
  ImageInput,
  Step,
  Toggle,
  storedImagesSummary,
  imageUploadError,
  warnImageStorageUse,
} from '../controls.jsx';
import { notify } from '../../lib/uiFeedback.js';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CropModal({ src, s, set, blockId, onClose }) {
  const [draft, setDraft] = useState({
    height: Number(s.imageHeightPx || 260),
    x: Number(s.imageX ?? 50),
    y: Number(s.imageY ?? 50),
  });
  const boxRef = useRef(null);
  const [targetWidth, setTargetWidth] = useState(360);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

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

  useEffect(() => {
    setDraft({
      height: Number(s.imageHeightPx || 260),
      x: Number(s.imageX ?? 50),
      y: Number(s.imageY ?? 50),
    });
  }, [src, s.imageHeightPx, s.imageX, s.imageY]);

  const clamp = (value) => Math.max(0, Math.min(100, value));

  const moveByPointer = (event) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100);
    setDraft((prev) => ({ ...prev, x, y }));
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveByPointer(event);
  };

  const onPointerMove = (event) => {
    if (event.buttons !== 1) return;
    moveByPointer(event);
  };

  const apply = () => {
    set({
      imageDisplay: 'fill',
      imageHeightPx: Number(draft.height),
      imageX: Number(draft.x),
      imageY: Number(draft.y),
    });
    onClose();
  };

  return createPortal(
    <div className="crop-modal-backdrop" role="dialog" aria-modal="true">
      <div className="crop-modal" style={{ '--crop-target-width': `${targetWidth}px` }}>
        <div className="crop-modal-head">
          <div>
            <strong>이미지 크롭</strong>
            <span>높이를 정하고, 이미지를 드래그해서 보이는 위치를 맞추세요.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        {!src ? (
          <div className="crop-empty">이미지를 먼저 업로드하세요.</div>
        ) : (
          <>
            <div
              ref={boxRef}
              className="crop-preview"
              style={{ height: `${draft.height}px` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
            >
              <img src={src} alt="" style={{ objectPosition: `${draft.x}% ${draft.y}%` }} draggable="false" />
              <span className="crop-guide">드래그로 위치 조정</span>
            </div>

            <label className="crop-slider">
              <span>높이</span>
              <input
                type="range"
                min="140"
                max="520"
                step="10"
                value={draft.height}
                onChange={(e) => setDraft((prev) => ({ ...prev, height: Number(e.target.value) }))}
              />
              <b>{draft.height}px</b>
            </label>
          </>
        )}

        <div className="crop-actions">
          <button type="button" onClick={() => setDraft({ height: 260, x: 50, y: 50 })}>초기화</button>
          <button type="button" onClick={onClose}>취소</button>
          <button type="button" className="primary" onClick={apply} disabled={!src}>적용</button>
        </div>
      </div>
    </div>,
    document.body
  );
}


function GalleryMultiUpload({ count = 0, max = 10, onAdd }) {
  const ref = useRef(null);
  const remain = Math.max(0, max - count);

  const pick = async (files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    const invalid = selected.find((file) => imageUploadError(file));
    if (invalid) {
      notify(imageUploadError(invalid), 'error');
      if (ref.current) ref.current.value = '';
      return;
    }

    const limited = selected.slice(0, remain);
    if (!limited.length) {
      notify(`갤러리는 최대 ${max}장까지 등록할 수 있습니다.`, 'error');
      if (ref.current) ref.current.value = '';
      return;
    }

    warnImageStorageUse(limited, `갤러리 이미지 ${limited.length}장`);

    try {
      const images = await Promise.all(limited.map(readFile));
      onAdd(images);
    } catch (error) {
      console.warn('Gallery image upload read failed:', error);
      notify('갤러리 이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.', 'error');
    }

    if (selected.length > remain) {
      notify(`최대 ${max}장까지만 등록됩니다. ${remain}장만 추가했습니다.`, 'error');
    }

    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="gallery-multi-upload">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e)=>pick(e.target.files)}
      />
      <button type="button" onClick={()=>ref.current?.click()} disabled={remain <= 0}>
        <span>＋</span>
        <b>여러 장 추가</b>
        <small>{count}/{max}</small>
      </button>
    </div>
  );
}

function StoredImageCleanup({ summary, mode, onRemoveSingle, onRemoveGallery }) {
  if (!summary.items.length) return null;
  const hasHeavyItems = summary.heavyItems.length > 0;
  return (
    <div className={`image-storage-cleanup ${hasHeavyItems ? 'warning' : ''}`}>
      <div>
        <strong>저장 이미지 용량 {summary.label}</strong>
        <span>{hasHeavyItems ? '큰 이미지는 저장 실패나 느린 복원의 원인이 될 수 있습니다.' : '브라우저 저장 공간에 포함되는 이미지입니다.'}</span>
      </div>
      {hasHeavyItems && (
        <div className="image-storage-actions">
          {mode === 'single' ? (
            <button type="button" onClick={onRemoveSingle}>저장 이미지 제거</button>
          ) : (
            summary.heavyItems.map((item) => (
              <button key={item.index} type="button" onClick={() => onRemoveGallery(item.index)}>
                {item.index + 1}번 제거
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ImageEditor({ s, set, block }) {
  const gallery = s.gallery || [];
  const display = s.imageDisplay || 'original';
  const editSrc = s.mode === 'gallery' ? gallery.find(Boolean) : s.image;
  const storageSummary = storedImagesSummary(s.mode === 'gallery' ? gallery : [s.image]);
  const [cropOpen, setCropOpen] = useState(false);

  const resetImageCrop = () => ({
    imageDisplay: 'original',
    imageHeightPx: 260,
    imageX: 50,
    imageY: 50,
  });

  const updateGallery = (i, v) => {
    set({ gallery: gallery.map((x, idx) => idx === i ? v : x) });
  };

  const removeGallery = (i) => {
    const next = gallery.filter((_, idx) => idx !== i);
    set(next.some(Boolean) ? { gallery: next } : { gallery: next, ...resetImageCrop() });
  };

  const updateSingleImage = (v) => {
    set(v ? { image: v, ...resetImageCrop() } : { image: '', ...resetImageCrop() });
  };

  const changeDisplay = (v) => {
    if (v === 'original') {
      set({ imageDisplay: 'original' });
      return;
    }

    set({
      imageDisplay: 'fill',
      imageHeightPx: Number(s.imageHeightPx || 260),
      imageX: Number(s.imageX ?? 50),
      imageY: Number(s.imageY ?? 50),
    });
  };

  const imageEditControls = (
    <div className="image-edit-attached">
      <div className="image-mode-toolbar">
        <button type="button" className={display === 'original' ? 'active' : ''} onClick={()=>changeDisplay('original')} title="원본비율">
          <span>▭</span>
          <b>원본비율</b>
        </button>
        <button type="button" className={display === 'fill' ? 'active' : ''} onClick={()=>changeDisplay('fill')} title="채우기">
          <span>▣</span>
          <b>채우기</b>
        </button>
        <button type="button" className={s.rounded ? 'active' : ''} onClick={()=>set({rounded:!s.rounded})} title="모서리">
          <span>◜</span>
          <b>둥글게</b>
        </button>
      </div>

      {display === 'original' ? (
        <div className="image-mode-note compact">
          원본 비율 그대로 가로 100%에 맞춰 표시됩니다.
        </div>
      ) : (
        <>
          <button type="button" className="crop-open-button" onClick={()=>setCropOpen(true)}>
            크롭 조정
          </button>
          {s.mode === 'gallery' && (
            <div className="image-mode-note compact">
              갤러리 크롭은 모든 이미지에 공통 적용됩니다.
            </div>
          )}
        </>
      )}

      {cropOpen && (
        <CropModal src={editSrc} s={s} set={set} blockId={block?.id} onClose={()=>setCropOpen(false)} />
      )}
    </div>
  );

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Choice label="표시" value={s.mode} onChange={(v)=>set({mode:v})} options={[['single','단일'],['gallery','갤러리']]}/>
        <StoredImageCleanup
          summary={storageSummary}
          mode={s.mode}
          onRemoveSingle={() => updateSingleImage('')}
          onRemoveGallery={removeGallery}
        />
        {s.mode === 'gallery' ? (
          <>
            <GalleryMultiUpload
              count={gallery.filter(Boolean).length}
              max={10}
              onAdd={(images)=>set({gallery:[...gallery.filter(Boolean), ...images].slice(0, 10)})}
            />
            <div className="gallery-edit">
              {gallery.map((img,i)=>(
                <div key={i}>
                  <ImageInput label={`${i+1}`} value={img} onChange={(v)=>updateGallery(i,v)}/>
                  <Danger onClick={()=>removeGallery(i)}/>
                </div>
              ))}
            </div>
            {gallery.length < 10 && <AddButton onClick={()=>set({gallery:[...gallery,'']})}/>}
          </>
        ) : (
          <ImageInput label="이미지" value={s.image} onChange={updateSingleImage}/>
        )}
        {imageEditControls}
      </Step>

      {s.mode === 'gallery' && (
        <Step title="표시" icon="2">
          <div className="image-slide-options">
            <Toggle label="자동전환" icon="▶" checked={s.autoplay} onChange={(v)=>set({autoplay:v})}/>
            {s.autoplay && <Choice label="전환 시간" value={String(s.interval)} onChange={(v)=>set({interval:Number(v)})} options={[['3','3초'],['5','5초'],['7','7초']]}/>}
            <Toggle label="화살표" icon="‹›" checked={s.galleryShowArrows ?? true} onChange={(v)=>set({galleryShowArrows:v})}/>
            <Toggle label="점 표시" icon="•••" checked={s.galleryShowDots ?? true} onChange={(v)=>set({galleryShowDots:v})}/>
          </div>
        </Step>
      )}

      <Step title="디자인" icon="3">
        <Field label="캡션" value={s.caption} onChange={(v)=>set({caption:v})}/>
      </Step>
    </EditorStack>
  );
}

