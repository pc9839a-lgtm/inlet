export function usePreviewWindow({ previewUrl, setPreviewCopyIssue, showToast }) {
  const openPreview = () => {
    if (typeof window === 'undefined') return;
    const opened = window.open(previewUrl, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
      setPreviewCopyIssue(null);
      return;
    }
    setPreviewCopyIssue({
      url: previewUrl,
      message: '브라우저에서 새 창 열기를 차단했습니다. 아래 주소를 직접 열어주세요.',
    });
    showToast('새 창 열기가 차단됐습니다. 주소를 직접 열어주세요.', 'warning');
  };

  return { openPreview };
}