import { useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import {
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimatedDataUrlBytes,
  formatBytes,
  readImageFileAsDataUrl,
  storedImageStorageInfo,
  validateImageUpload,
} from '../lib/imageUploadGuard.js';
import { notify } from '../lib/uiFeedback.js';

export { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_WARN_BYTES };
export const IMAGE_UPLOAD_BATCH_WARN_BYTES = 4 * 1024 * 1024;

export function formatFileSize(bytes = 0) {
  return formatBytes(bytes);
}

export function estimateImageStorageBytes(file) {
  return estimatedDataUrlBytes(file);
}

export function storedImageInfo(value) {
  return storedImageStorageInfo(value);
}

export function storedImagesSummary(images = []) {
  const items = images
    .map((value, index) => ({ index, ...storedImageInfo(value) }))
    .filter((item) => item.stored);
  const bytes = items.reduce((sum, item) => sum + item.bytes, 0);
  return {
    items,
    bytes,
    label: formatFileSize(bytes),
    heavyItems: items.filter((item) => item.heavy),
  };
}

export function imageUploadError(file) {
  const result = validateImageUpload(file);
  return result.ok ? '' : result.message;
}

export function warnImageStorageUse(files, context = '이미지') {
  const list = Array.from(files || []);
  if (!list.length) return;
  const estimated = list.reduce((sum, file) => sum + estimateImageStorageBytes(file), 0);
  const large = list.find((file) => estimateImageStorageBytes(file) >= IMAGE_UPLOAD_WARN_BYTES);
  if (estimated >= IMAGE_UPLOAD_BATCH_WARN_BYTES) {
    notify(`${context}가 브라우저 저장 공간을 약 ${formatFileSize(estimated)} 사용합니다. 저장 실패가 반복되면 이미지를 줄여주세요.`, 'warning');
    return;
  }
  if (large) {
    notify(`${large.name || '이미지'}는 저장 시 약 ${formatFileSize(estimateImageStorageBytes(large))}를 차지합니다. 이미지가 많으면 저장 공간이 부족할 수 있습니다.`, 'warning');
  }
}

function readFile(file) {
  return readImageFileAsDataUrl(file);
}

export function EditorStack({ children }) {
  return <div className="editor-stack">{children}</div>;
}

export function Step({ title, icon, children, open = false }) {
  const [isOpen, setOpen] = useState(open);
  return (
    <section className={`step ${isOpen ? 'open' : ''}`}>
      <button className="step-title" type="button" onClick={() => setOpen(!isOpen)}>
        <span>{icon}</span>
        <strong>{title}</strong>
        <i>{isOpen ? '⌃' : '⌄'}</i>
      </button>
      {isOpen && <div className="step-body">{children}</div>}
    </section>
  );
}

export function Two({ children }) {
  return <div className="two-col">{children}</div>;
}

export function LineList({ children }) {
  return <div className="mini-list">{children}</div>;
}

export function MiniDetail({ icon, title, badge, children }) {
  return (
    <details className="mini-detail">
      <summary>
        <span>{icon}</span>
        <strong>{title}</strong>
        {badge && <em>{badge}</em>}
      </summary>
      <div className="mini-body">{children}</div>
    </details>
  );
}

export function AddButton({ onClick }) {
  return <button className="add-line add-line-clean" onClick={onClick}>＋ 추가</button>;
}

export function Danger({ onClick }) {
  return <button className="danger-btn danger-btn-clean" onClick={onClick}>삭제</button>;
}

export function Choice({ label, value, onChange, options }) {
  return (
    <div className="choice choice-clean" data-count={options.length}>
      <span>{label}</span>
      <div>
        {options.map(([v, icon]) => (
          <button key={v} type="button" title={String(v)} className={String(value) === String(v) ? 'active' : ''} onClick={() => onChange(v)}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <div className="toggle toggle-clean">
      <span>{label}</span>
      <button type="button" aria-label={label} className={checked ? 'active' : ''} disabled={disabled} onClick={() => !disabled && onChange(!checked)}>
        <i></i>
      </button>
    </div>
  );
}

export function Field({ label, value, onChange, textarea, type = 'text', prefix = '', placeholder = '', disabled = false }) {
  const kind = /제목|문구|상호명|대표자|로고|메뉴명|버튼/.test(label)
    ? 'title'
    : /설명|내용|주소|URL|메시지|코드|문구/.test(label)
      ? 'content'
      : 'option';

  return (
    <label className={`field field-${kind}`}>
      <span>{label}</span>
      <div className={prefix ? 'prefix-field' : ''}>
        {prefix && <em>{prefix}</em>}
        {textarea
          ? <textarea value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
          : <input type={type} value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      </div>
    </label>
  );
}

export function ImageInput({ label, value, onChange, disabled = false }) {
  const ref = useRef(null);
  const storageInfo = storedImageInfo(value);
  const pick = async (file) => {
    if (disabled) return;
    if (!file) return;
    const error = imageUploadError(file);
    if (error) {
      notify(error, 'error');
      if (ref.current) ref.current.value = '';
      return;
    }
    warnImageStorageUse([file], label || '이미지');
    try {
      onChange(await readFile(file));
    } catch (readError) {
      console.warn('Image upload read failed:', readError);
      notify('이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.', 'error');
    } finally {
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="image-input">
      <span>{label}</span>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className="image-box single-plus">
        {value ? (
          <>
            <img src={value} alt="" />
            <div className="image-actions">
              <button type="button" disabled={disabled} onClick={() => ref.current?.click()} title="수정" aria-label={`${label} 수정`}>✎</button>
              <button type="button" disabled={disabled} onClick={() => onChange('')} title="삭제" aria-label={`${label} 삭제`}>×</button>
            </div>
          </>
        ) : (
          <button type="button" className="image-empty-button" disabled={disabled} onClick={() => ref.current?.click()} title="업로드" aria-label={`${label} 업로드`}>＋</button>
        )}
      </div>
      {storageInfo.stored && (
        <small className={`image-storage-note ${storageInfo.heavy ? 'warning' : ''}`}>
          저장 이미지 {storageInfo.label}{storageInfo.heavy ? ' · 용량 큼' : ''}
        </small>
      )}
    </div>
  );
}

export function Weekdays({ value, onToggle }) {
  const days = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금'], ['sat', '토'], ['sun', '일']];
  return (
    <div className="weekday weekday-fixed">
      <span>상담 가능 요일</span>
      <div>
        {days.map(([key, label]) => (
          <button key={key} type="button" className={value.includes(key) ? 'active' : ''} onClick={() => onToggle(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Color({ label, value, onChange }) {
  const pick = async () => {
    if (!window.EyeDropper) {
      notify('이 브라우저에서는 스포이드 기능을 지원하지 않습니다. Chrome/Edge 최신 버전에서 사용해주세요.', 'error');
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch (error) {
      // User cancelled the eyedropper.
    }
  };

  return (
    <label className="color color-clean">
      <span>{label}</span>
      <div className="color-main color-main-v15">
        <input type="color" value={value || '#111827'} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="eyedropper" onClick={pick} title="미리보기에서 색상 추출" aria-label={`${label} 색상 추출`}><Pipette size={19} /></button>
      </div>
    </label>
  );
}

export function Range({ label, value, min = 0, max = 100, onChange }) {
  return (
    <label className="range">
      <span>{label}</span>
      <div>
        <input type="range" min={min} max={max} value={value ?? 0} onChange={(e) => onChange(e.target.value)} />
        <b>{value ?? 0}</b>
      </div>
    </label>
  );
}
