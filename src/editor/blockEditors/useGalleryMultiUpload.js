import { useRef, useState } from 'react';
import { notify } from '../../lib/uiFeedback.js';
import { formatFileSize, imageDataFingerprint } from '../imageControlModel.js';
import { prepareGalleryImageFile } from './imageFileModel.js';
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

const INITIAL_UPLOAD_STATE = { status: 'idle', progress: 0, label: '' };
const GALLERY_EMBEDDED_TOTAL_TARGET_BYTES = 600 * 1024;
const GALLERY_IMAGE_MIN_TARGET_BYTES = 72 * 1024;
const GALLERY_IMAGE_MAX_TARGET_BYTES = 180 * 1024;
const GALLERY_IMAGE_MAX_BYTES = 240 * 1024;

function galleryImageBudget(currentCount, incomingCount, max) {
  const totalCount = Math.max(1, Math.min(max, Number(currentCount || 0) + Number(incomingCount || 0)));
  const targetBytes = Math.max(
    GALLERY_IMAGE_MIN_TARGET_BYTES,
    Math.min(GALLERY_IMAGE_MAX_TARGET_BYTES, Math.floor(GALLERY_EMBEDDED_TOTAL_TARGET_BYTES / totalCount)),
  );
  const maxBytes = Math.min(
    GALLERY_IMAGE_MAX_BYTES,
    Math.max(targetBytes, Math.round(targetBytes * 1.35)),
  );
  return { targetBytes, maxBytes };
}

export function useGalleryMultiUpload({ count = 0, max = 10, images = [], onAdd }) {
  const inputRef = useRef(null);
  const [uploadState, setUploadState] = useState(INITIAL_UPLOAD_STATE);
  const remain = getGalleryUploadRemain(count, max);

  const pick = async (files) => {
    if (uploadState.status === 'processing') return;
    const selected = normalizeGalleryFiles(files);
    if (!selected.length) return;

    const invalid = getInvalidGalleryFile(selected);
    if (invalid) {
      notify(invalid.message, 'error');
      setUploadState({ status: 'error', progress: 0, label: invalid.message });
      resetGalleryInput(inputRef);
      return;
    }

    const limited = limitGalleryFiles(selected, remain);
    if (!limited.length) {
      notify(galleryFullMessage(max), 'error');
      setUploadState({ status: 'error', progress: 0, label: galleryFullMessage(max) });
      resetGalleryInput(inputRef);
      return;
    }

    warnGalleryStorageUse(limited);
    setUploadState({ status: 'processing', progress: 2, label: `1/${limited.length} 이미지 준비 중` });

    try {
      const fingerprints = new Set(images.map(imageDataFingerprint).filter(Boolean));
      const optimizedImages = [];
      const imageBudget = galleryImageBudget(count, limited.length, max);
      let duplicateCount = 0;
      let originalBytes = 0;
      let finalBytes = 0;

      for (let index = 0; index < limited.length; index += 1) {
        const file = limited[index];
        const result = await prepareGalleryImageFile(file, {
          targetBytes: imageBudget.targetBytes,
          maxBytes: imageBudget.maxBytes,
          onProgress: ({ progress, label }) => {
            const combinedProgress = Math.round(((index + (Number(progress || 0) / 100)) / limited.length) * 100);
            setUploadState({
              status: 'processing',
              progress: combinedProgress,
              label: `${index + 1}/${limited.length} ${label || '이미지 처리 중'}`,
            });
          },
        });
        originalBytes += result.originalBytes;
        finalBytes += result.finalBytes;
        if (result.fingerprint && fingerprints.has(result.fingerprint)) {
          duplicateCount += 1;
          continue;
        }
        fingerprints.add(result.fingerprint);
        optimizedImages.push(result.dataUrl);
      }

      if (optimizedImages.length) onAdd(optimizedImages);
      if (duplicateCount) {
        notify(`같은 이미지 ${duplicateCount}장은 추가하지 않았습니다.`, 'info');
      }
      if (optimizedImages.length) {
        const resultLabel = originalBytes > finalBytes
          ? `${formatFileSize(originalBytes)} → ${formatFileSize(finalBytes)}`
          : `${optimizedImages.length}장 업로드 완료`;
        setUploadState({ status: 'success', progress: 100, label: resultLabel });
        if (originalBytes - finalBytes >= 512 * 1024) {
          notify(`갤러리 이미지를 총 ${formatFileSize(finalBytes)}로 최적화했습니다.`, 'success');
        }
      } else {
        setUploadState({ status: 'success', progress: 100, label: '중복 이미지 · 추가 안 함' });
      }
    } catch (error) {
      console.warn('Gallery image upload processing failed:', error);
      const message = error?.message || '갤러리 이미지를 처리하지 못했습니다. 다른 파일로 다시 시도해주세요.';
      setUploadState({ status: 'error', progress: 0, label: message });
      notify(message, 'error');
    }

    if (selected.length > remain) {
      notify(galleryTruncatedMessage(max, remain), 'error');
    }

    resetGalleryInput(inputRef);
  };

  return { inputRef, remain, pick, uploadState };
}
