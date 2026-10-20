import { getEditorDraftPreviewPage } from './previewTarget.js';

export function usePreviewWindow({ previewUrl, setPreviewCopyIssue, showToast }) {
  const openPreview = () => {
    if (typeof window === 'undefined') return;
    const draft = getEditorDraftPreviewPage();
    if (!draft || !Array.isArray(draft.blocks)) {
      setPreviewCopyIssue({
        kind: 'unavailable',
        url: previewUrl,
        message: '현재 초안을 불러올 수 없습니다. 발행 주소는 아래에서 별도로 확인할 수 있습니다.',
      });
      showToast?.('현재 초안 미리보기를 불러오지 못했습니다.', 'warning');
      return;
    }

    // The existing editor route stays mounted; no publish or network request is
    // needed to inspect unsaved changes. The public URL is a separate action.
    setPreviewCopyIssue({ kind: 'draft', page: draft, publishedUrl: previewUrl });
  };

  return { openPreview };
}
