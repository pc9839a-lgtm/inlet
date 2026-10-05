import { useAccessibleDialog } from '../../lib/useAccessibleDialog.js';

export function useImageCropDialog(onClose) {
  return useAccessibleDialog(onClose, { lockScroll: true });
}
