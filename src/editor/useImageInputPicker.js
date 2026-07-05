import { useRef } from 'react';
import { notify } from '../lib/uiFeedback.js';
import { imageUploadError, readEditorImageFile, warnImageStorageUse } from './imageControlModel.js';

export function useImageInputPicker({ label, onChange, disabled }) {
  const ref = useRef(null);

  const resetInput = () => {
    if (ref.current) ref.current.value = '';
  };

  const openPicker = () => {
    if (!disabled) ref.current?.click();
  };

  const clearImage = () => onChange('');

  const pick = async (file) => {
    if (disabled || !file) return;
    const error = imageUploadError(file);
    if (error) {
      notify(error, 'error');
      resetInput();
      return;
    }
    warnImageStorageUse([file], label || '이미지');
    try {
      onChange(await readEditorImageFile(file));
    } catch (readError) {
      console.warn('Image upload read failed:', readError);
      notify('이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.', 'error');
    } finally {
      resetInput();
    }
  };

  return { ref, pick, openPicker, clearImage };
}