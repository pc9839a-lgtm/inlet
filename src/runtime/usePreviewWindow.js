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
      message: 'The browser blocked the preview window. Open the URL below directly.',
    });
    showToast('The preview window was blocked. Open the URL directly.', 'warning');
  };

  return { openPreview };
}