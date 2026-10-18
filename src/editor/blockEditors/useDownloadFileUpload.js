import { useEffect, useRef, useState } from 'react';
import { uploadDownloadFile } from '../../lib/fileRepository.js';
import { notify } from '../../lib/uiFeedback.js';
import {
  clearDownloadUploadPatch,
  createDownloadUploadPatch,
  validateDownloadUploadFile,
} from './downloadUploadModel.js';

export function useDownloadFileUpload({ item, page, authUser, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const itemRef = useRef(item);
  const onChangeRef = useRef(onChange);
  itemRef.current = item;
  onChangeRef.current = onChange;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const pick = async (file) => {
    if (!file) return;
    const validation = validateDownloadUploadFile(file);
    if (!validation.ok) {
      notify(validation.message, 'error');
      resetInput();
      return;
    }

    const generation = ++generationRef.current;
    const filePatch = createDownloadUploadPatch(file, itemRef.current, validation.extension);
    const expected = { id: itemRef.current.id, fileName: filePatch.fileName, extension: filePatch.extension };
    const pendingPatch = { ...filePatch, fileUrl: '' };
    itemRef.current = { ...itemRef.current, ...pendingPatch };
    onChangeRef.current(pendingPatch);
    setUploading(true);

    // A deleted item, a cleared/replaced file or an older request cannot
    // receive a late response (including a late failure).
    const isCurrent = () => {
      const current = itemRef.current;
      return mountedRef.current && generation === generationRef.current
        && current?.id === expected.id
        && current?.fileName === expected.fileName
        && current?.extension === expected.extension
        && !current?.fileUrl;
    };

    try {
      const result = await uploadDownloadFile(file, page, authUser);
      if (!isCurrent()) return;
      const fileUrl = result?.downloadUrl || result?.url || '';
      if (!fileUrl) throw new Error('업로드된 파일 주소를 받지 못했습니다.');
      // Never replay the initial title/description or the initial items list.
      onChangeRef.current({ fileUrl, fileBytes: Number(result.size || file.size || 0) });
      notify('업로드 완료', 'success');
    } catch (error) {
      if (!isCurrent()) return;
      onChangeRef.current(clearDownloadUploadPatch());
      console.warn('Download file upload failed:', error);
      notify(error?.message || '업로드 실패', 'error');
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setUploading(false);
        resetInput();
      }
    }
  };

  return {
    inputRef,
    uploading,
    pick,
    openPicker: () => inputRef.current?.click(),
    clearFile: () => {
      generationRef.current += 1;
      setUploading(false);
      resetInput();
      onChangeRef.current(clearDownloadUploadPatch());
    },
  };
}
