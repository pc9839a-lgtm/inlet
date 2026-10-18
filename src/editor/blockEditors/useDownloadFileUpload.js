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
  const uploadGenerationRef = useRef(0);

  // Ignore completions from removed blocks/items and replaced requests.
  useEffect(() => () => { uploadGenerationRef.current += 1; }, []);

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

    const generation = ++uploadGenerationRef.current;
    const patch = createDownloadUploadPatch(file, item, validation.extension);
    onChange(patch);
    setUploading(true);

    try {
      const result = await uploadDownloadFile(file, page, authUser);
      if (generation !== uploadGenerationRef.current) return;
      // Only file metadata belongs to the async completion; preserve title
      // edits and any items inserted after upload began.
      onChange({
        fileUrl: result.downloadUrl || result.url || '',
        fileBytes: Number(result.size || file.size || 0),
      });
      notify('업로드 완료', 'success');
    } catch (error) {
      if (generation !== uploadGenerationRef.current) return;
      console.warn('Download file upload failed:', error);
      notify(error?.message || '업로드 실패', 'error');
    } finally {
      if (generation === uploadGenerationRef.current) {
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
      uploadGenerationRef.current += 1;
      setUploading(false);
      resetInput();
      onChange(clearDownloadUploadPatch());
    },
  };
}
