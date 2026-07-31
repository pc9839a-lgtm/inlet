import { useRef, useState } from 'react';
import { notify } from '../lib/uiFeedback.js';
import {
  formatFileSize,
  imageDataFingerprint,
  imageUploadError,
  prepareEditorImageFile,
  warnImageStorageUse,
} from './imageControlModel.js';

const INITIAL_UPLOAD_STATE = {
  status: 'idle',
  progress: 0,
  label: '',
  originalBytes: 0,
  finalBytes: 0,
};

export function useImageInputPicker({ label, value, onChange, disabled }) {
  const ref = useRef(null);
  const [uploadState, setUploadState] = useState(INITIAL_UPLOAD_STATE);

  const resetInput = () => {
    if (ref.current) ref.current.value = '';
  };

  const openPicker = () => {
    if (!disabled && uploadState.status !== 'processing') ref.current?.click();
  };

  const clearImage = () => {
    if (uploadState.status === 'processing') return;
    onChange('');
    setUploadState(INITIAL_UPLOAD_STATE);
  };

  const pick = async (file) => {
    if (disabled || !file || uploadState.status === 'processing') return;
    const error = imageUploadError(file);
    if (error) {
      notify(error, 'error');
      setUploadState({ ...INITIAL_UPLOAD_STATE, status: 'error', label: error });
      resetInput();
      return;
    }
    warnImageStorageUse([file], label || '이미지');
    setUploadState({
      ...INITIAL_UPLOAD_STATE,
      status: 'processing',
      progress: 4,
      label: '이미지 준비 중',
      originalBytes: Number(file.size || 0),
    });
    try {
      const result = await prepareEditorImageFile(file, {
        onProgress: ({ progress, label: progressLabel }) => {
          setUploadState((current) => ({
            ...current,
            status: 'processing',
            progress: Number(progress || 0),
            label: progressLabel || '이미지 처리 중',
          }));
        },
      });

      if (imageDataFingerprint(value) && imageDataFingerprint(value) === result.fingerprint) {
        notify('현재 등록된 이미지와 같은 파일입니다.', 'info');
        setUploadState({
          status: 'success',
          progress: 100,
          label: '같은 이미지 · 변경 없음',
          originalBytes: result.originalBytes,
          finalBytes: result.finalBytes,
        });
        return;
      }

      onChange(result.dataUrl);
      setUploadState({
        status: 'success',
        progress: 100,
        label: result.compressed
          ? `${formatFileSize(result.originalBytes)} → ${formatFileSize(result.finalBytes)}`
          : `업로드 완료 · ${formatFileSize(result.finalBytes)}`,
        originalBytes: result.originalBytes,
        finalBytes: result.finalBytes,
      });
      if (result.compressed && result.savedBytes >= 256 * 1024) {
        notify(`이미지를 ${formatFileSize(result.finalBytes)}로 최적화했습니다.`, 'success');
      }
    } catch (readError) {
      console.warn('Image upload processing failed:', readError);
      const message = readError?.message || '이미지를 처리하지 못했습니다. 다른 파일로 다시 시도해주세요.';
      setUploadState({ ...INITIAL_UPLOAD_STATE, status: 'error', label: message });
      notify(message, 'error');
    } finally {
      resetInput();
    }
  };

  return { ref, pick, openPicker, clearImage, uploadState };
}
