import { useRef } from 'react';
import { notify } from '../../lib/uiFeedback.js';
import { readImageFile } from './imageFileModel.js';
import {
  galleryFullMessage,
  galleryTruncatedMessage,
  getGalleryUploadRemain,
  getInvalidGalleryFile,
  limitGalleryFiles,
  normalizeGalleryFiles,
  resetGalleryInput,
  warnGalleryStorageUse,
} from './galleryUploadModel.js';

export function useGalleryMultiUpload({ count = 0, max = 10, onAdd }) {
  const inputRef = useRef(null);
  const remain = getGalleryUploadRemain(count, max);

  const pick = async (files) => {
    const selected = normalizeGalleryFiles(files);
    if (!selected.length) return;

    const invalid = getInvalidGalleryFile(selected);
    if (invalid) {
      notify(invalid.message, 'error');
      resetGalleryInput(inputRef);
      return;
    }

    const limited = limitGalleryFiles(selected, remain);
    if (!limited.length) {
      notify(galleryFullMessage(max), 'error');
      resetGalleryInput(inputRef);
      return;
    }

    warnGalleryStorageUse(limited);

    try {
      const images = await Promise.all(limited.map(readImageFile));
      onAdd(images);
    } catch (error) {
      console.warn('Gallery image upload read failed:', error);
      notify('갤러리 이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.', 'error');
    }

    if (selected.length > remain) {
      notify(galleryTruncatedMessage(max, remain), 'error');
    }

    resetGalleryInput(inputRef);
  };

  return { inputRef, remain, pick };
}
