import { useRef, useState } from 'react';
import { AddButton, Choice, EditorStack, Field, LineList, MiniDetail, Step, Toggle, Two, formatFileSize } from '../controls.jsx';
import { alignOptions } from '../editorOptions.js';
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

function FileMetaPicker({ item, page, authUser, onChange }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    const extension = extensionFromName(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      notify('PDF, PPT, PPTX, XLS, XLSX 파일만 등록 가능합니다.', 'error');
      if (ref.current) ref.current.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      notify('파일은 20MB 이하만 업로드할 수 있습니다. PDF 압축 후 다시 올려주세요.', 'error');
      if (ref.current) ref.current.value = '';
      return;
    }
    const metaPatch = {
      fileName: file.name,
      extension,
      badge: extension.toUpperCase(),
      sizeLabel: formatFileSize(file.size),
      title: item.title && item.title !== '새 자료' ? item.title : file.name.replace(/\.[^.]+$/, ''),
    };
    onChange(metaPatch);
    setUploading(true);
    try {
      const result = await uploadDownloadFile(file, page, authUser);
      onChange({
        ...metaPatch,
        fileUrl: result.downloadUrl || result.url || '',
      });
      notify('자료 업로드가 완료됐습니다.', 'success');
    } catch (error) {
      console.warn('Download file upload failed:', error);
      notify(error?.message || '파일 업로드에 실패했습니다. R2 저장소 설정을 확인해주세요.', 'error');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="download-editor-filemeta">
      <button type="button" disabled={uploading} onClick={() => ref.current?.click()}>{uploading ? '업로드중' : '파일 업로드'}</button>
      <span>PDF/PPT/엑셀 · 20MB 이하</span>
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
      <Step title="기본" icon="1" open>
        <Two>
          <Field label="제목" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="버튼 문구" value={s.buttonLabel || '다운로드'} onChange={(v) => set({ buttonLabel: v })} />
        </Two>
        <Field label="설명" value={s.desc} textarea onChange={(v) => set({ desc: v })} />
        <Toggle label="새 창 열기" checked={s.newWindow !== false} onChange={(v) => set({ newWindow: v })} />
      </Step>

      <Step title="자료" icon="2" open>
        <LineList>
          {items.map((item, index) => (
            <MiniDetail key={item.id} icon={item.extension?.toUpperCase?.() || 'FILE'} title={item.title} badge={item.sizeLabel || item.badge}>
              <div className="download-editor-item">
                <Two>
                  <Field label="자료명" value={item.title} onChange={(v) => update(item.id, { title: v })} />
                  <Field label="표기" value={item.badge} onChange={(v) => update(item.id, { badge: v })} placeholder="PDF" />
                </Two>
                <Field label="설명" value={item.desc} textarea onChange={(v) => update(item.id, { desc: v })} />
                <Field label="파일 URL" value={item.fileUrl} onChange={(v) => update(item.id, { fileUrl: v })} placeholder="https://.../proposal.pdf" />
                <Two>
                  <Field label="파일명" value={item.fileName} onChange={(v) => update(item.id, { fileName: v, extension: pickSafe(extensionFromName(v), ALLOWED_EXTENSIONS, item.extension || 'pdf') })} placeholder="proposal.pdf" />
                  <Field label="용량" value={item.sizeLabel} onChange={(v) => update(item.id, { sizeLabel: v })} placeholder="12MB" />
                </Two>
                <Choice label="확장자" value={item.extension} onChange={(v) => update(item.id, { extension: v, badge: v.toUpperCase() })} options={ALLOWED_EXTENSIONS.map((ext) => [ext, ext.toUpperCase()])} />
                <FileMetaPicker item={item} page={page} authUser={authUser} onChange={(patch) => update(item.id, patch)} />
                <button type="button" className="simple-delete-btn" onClick={() => remove(item.id)} disabled={items.length <= 1}>삭제</button>
              </div>
            </MiniDetail>
          ))}
        </LineList>
        <AddButton onClick={add} />
      </Step>

      <Step title="표시" icon="3">
        <Choice label="형태" value={s.layout || 'card'} onChange={(v) => set({ layout: v })} options={[['card', '카드'], ['list', '목록']]} />
        <Choice label="정렬" value={s.align || 'left'} onChange={(v) => set({ align: v })} options={alignOptions} />
      </Step>
    </EditorStack>
  );
}
