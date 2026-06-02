import { useRef, useState } from 'react';
import { AddButton, EditorStack, Field, Step, formatFileSize } from '../controls.jsx';
import { uploadDownloadFile } from '../../lib/fileRepository.js';
import { pickSafe, uid } from '../../lib/pageModel.js';
import { notify } from '../../lib/uiFeedback.js';

const ALLOWED_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'xls', 'xlsx'];
const ACCEPT = '.pdf,.ppt,.pptx,.xls,.xlsx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_BYTES = 20 * 1024 * 1024;

function extensionFromName(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || 'pdf';
}

function normalizeItem(item = {}, index = 0) {
  const extension = pickSafe(String(item.extension || extensionFromName(item.fileName)).replace(/^\./, '').toLowerCase(), ALLOWED_EXTENSIONS, 'pdf');
  return {
    id: item.id || uid(),
    badge: item.badge || extension.toUpperCase(),
    title: item.title || item.label || `자료 ${index + 1}`,
    desc: item.desc || '',
    fileName: item.fileName || '',
    fileUrl: item.fileUrl || item.url || '',
    extension,
    sizeLabel: item.sizeLabel || '',
  };
}

function FileUploadRow({ item, page, authUser, onChange }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    const extension = extensionFromName(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      notify('PDF, PPT, 엑셀 파일만 업로드할 수 있습니다.', 'error');
      if (ref.current) ref.current.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      notify('파일은 20MB 이하만 업로드할 수 있습니다.', 'error');
      if (ref.current) ref.current.value = '';
      return;
    }

    const patch = {
      fileName: file.name,
      extension,
      badge: extension.toUpperCase(),
      sizeLabel: formatFileSize(file.size),
      title: item.title && item.title !== '새 자료' ? item.title : file.name.replace(/\.[^.]+$/, ''),
    };
    onChange(patch);
    setUploading(true);

    try {
      const result = await uploadDownloadFile(file, page, authUser);
      onChange({ ...patch, fileUrl: result.downloadUrl || result.url || '' });
      notify('업로드 완료', 'success');
    } catch (error) {
      console.warn('Download file upload failed:', error);
      notify(error?.message || '업로드 실패', 'error');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="download-upload-row">
      <label>파일 업로드<span>*</span></label>
      <div className="download-upload-control">
        <button type="button" disabled={uploading} onClick={() => ref.current?.click()}>
          {item.fileName || (uploading ? '업로드 중' : '파일 선택')}
        </button>
        {item.sizeLabel && <em>{item.sizeLabel}</em>}
        {item.fileUrl && <button type="button" className="download-remove-file" onClick={() => onChange({ fileName: '', fileUrl: '', sizeLabel: '' })}>삭제</button>}
      </div>
      <input ref={ref} type="file" accept={ACCEPT} hidden disabled={uploading} onChange={(event) => pick(event.target.files?.[0])} />
    </div>
  );
}

export default function DownloadEditor({ s, set, page, authUser }) {
  const items = (s.items || []).map(normalizeItem);
  const update = (id, patch) => set({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const remove = (id) => set({ items: items.filter((item) => item.id !== id) });
  const add = () => set({ items: [...items, normalizeItem({ id: uid(), title: '새 자료', extension: 'pdf', badge: 'PDF' }, items.length)] });

  return (
    <EditorStack>
      <Step title="파일 공유" icon="1" open>
        <div className="download-simple-list">
          {items.map((item, index) => (
            <div key={item.id} className="download-simple-card">
              <div className="download-simple-head">
                <strong>파일 {index + 1}</strong>
                <button type="button" onClick={() => remove(item.id)} disabled={items.length <= 1}>삭제</button>
              </div>
              <Field label="대표문구" value={item.title} onChange={(value) => update(item.id, { title: value })} />
              <Field label="상세설명" value={item.desc} onChange={(value) => update(item.id, { desc: value })} />
              <FileUploadRow item={item} page={page} authUser={authUser} onChange={(patch) => update(item.id, patch)} />
            </div>
          ))}
        </div>
        <AddButton onClick={add} />
      </Step>
    </EditorStack>
  );
}
