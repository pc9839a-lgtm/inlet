export function usePreviewWindow({ previewUrl, setPreviewCopyIssue, showToast }) {
  const openPreview = () => {
    if (typeof document === 'undefined') return;
    try {
      // An anchor with rel=noopener avoids window.open's ambiguous null
      // return value and never grants the target access to window.opener.
      const link = document.createElement('a');
      link.href = previewUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setPreviewCopyIssue(null);
    } catch {
      setPreviewCopyIssue({
        url: previewUrl,
        message: '새 창을 열지 못했습니다. 아래 주소를 직접 열어주세요.',
      });
      showToast('새 창을 열지 못했습니다. 주소를 직접 열어주세요.', 'warning');
    }
  };

  return { openPreview };
}
