import { useRef, useState } from 'react';
import { fetchLinkPreview } from '../../lib/linkPreview.js';
import { notify } from '../../lib/uiFeedback.js';
import { readImageFile } from './imageFileModel.js';
import {
  createAutoLinkThumbPatch,
  createUploadedLinkThumbPatch,
  getLinkThumbStorage,
  resetLinkThumbInput,
  validateLinkThumbFile,
  warnLinkThumbStorage,
} from './linkThumbPickerModel.js';

export function useLinkThumbPicker(item, onChange) {
  const [loading, setLoading] = useState(false);
  const uploadRef = useRef(null);
  const thumbStorage = getLinkThumbStorage(item.thumb);

  const autoThumb = async () => {
    setLoading(true);
    try {
      const preview = await fetchLinkPreview(item.url);
      onChange(createAutoLinkThumbPatch(item, preview));
    } finally {
      setLoading(false);
    }
  };

  const uploadThumb = async (file) => {
    if (!file) return;
    const validation = validateLinkThumbFile(file);
    if (!validation.ok) {
      notify(validation.message, 'error');
      resetLinkThumbInput(uploadRef);
      return;
    }
    warnLinkThumbStorage(file);
    try {
      const dataUrl = await readImageFile(file);
      onChange(createUploadedLinkThumbPatch(dataUrl));
    } catch (readError) {
      console.warn('Link thumbnail upload read failed:', readError);
      notify('썸네일 이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.', 'error');
    } finally {
      resetLinkThumbInput(uploadRef);
    }
  };

  return { loading, uploadRef, thumbStorage, autoThumb, uploadThumb };
}
