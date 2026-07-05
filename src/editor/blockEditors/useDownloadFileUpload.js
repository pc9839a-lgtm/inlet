import { useRef, useState } from 'react';
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

    const patch = createDownloadUploadPatch(file, item, validation.extension);
    onChange(patch);
    setUploading(true);

    try {
      const result = await uploadDownloadFile(file, page, authUser);
      onChange({ ...patch, fileUrl: result.downloadUrl || result.url || '', fileBytes: Number(result.size || file.size || 0) });
      notify('업로드 완료', 'success');
    } catch (error) {
      console.warn('Download file upload failed:', error);
      notify(error?.message || '업로드 실패', 'error');
    } finally {
      setUploading(false);
      resetInput();
    }
  };

  return {
    inputRef,
    uploading,
    pick,
    openPicker: () => inputRef.current?.click(),
    clearFile: () => onChange(clearDownloadUploadPatch()),
  };
}
