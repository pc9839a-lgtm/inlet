import { getEditorDraftPreviewPage } from './previewTarget.js';
import { draftPreviewChannelName, draftPreviewTabUrl } from './draftPreviewTabTransport.js';

// Open the current (even unpublished) editor draft in a real browser tab.
// The page snapshot is sent directly tab-to-tab and is never put in a URL,
// localStorage, sessionStorage, or the public page API.
export function usePreviewWindow({ previewUrl, showToast }) {
  // Keep this callback factory usable by non-React preview contract tests.
  // Pending channels self-expire after 30s even when the editor unmounts.
  const pending = new Set();

  const openPreview = () => {
    if (typeof window === 'undefined') return;
    const draft = getEditorDraftPreviewPage();
    const openTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

    if (!draft || !Array.isArray(draft.blocks)) {
      if (previewUrl) openTab(previewUrl);
      else showToast?.('미리보기를 열 수 없습니다. 페이지를 먼저 선택해주세요.', 'warning');
      return;
    }

    // Older browsers without BroadcastChannel can still open the published
    // URL, but must not misrepresent it as the unpublished page.
    if (typeof BroadcastChannel === 'undefined' || !window.crypto?.randomUUID) {
      if (previewUrl) openTab(previewUrl);
      showToast?.('이 브라우저에서는 미발행 초안을 새 탭으로 전달할 수 없어 발행본을 열었습니다.', 'warning');
      return;
    }

    const token = window.crypto.randomUUID();
    let channel;
    try {
      channel = new BroadcastChannel(draftPreviewChannelName(token));
    } catch {
      if (previewUrl) openTab(previewUrl);
      showToast?.('초안 미리보기 연결을 만들 수 없어 발행본을 열었습니다.', 'warning');
      return;
    }

    let expiry;
    const close = () => {
      window.clearTimeout(expiry);
      channel.close();
      pending.delete(close);
    };
    channel.onmessage = (event) => {
      if (event.data?.token !== token) return;
      if (event.data?.type === 'ready') {
        try { channel.postMessage({ type: 'draft', token, page: draft }); }
        catch {
          showToast?.('미리보기 데이터를 전달하지 못했습니다.', 'error');
          close();
        }
      } else if (event.data?.type === 'received') {
        close();
      }
    };
    pending.add(close);
    expiry = window.setTimeout(close, 30000);
    try {
      openTab(draftPreviewTabUrl(token, window.location.origin));
    } catch {
      close();
      showToast?.('새 탭을 열지 못했습니다. 팝업 차단 설정을 확인해주세요.', 'warning');
    }
  };

  return { openPreview };
}
