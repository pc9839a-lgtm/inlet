import { getEditorDraftPreviewPage } from './previewTarget.js';
import { draftPreviewChannelName, draftPreviewTabUrl } from './draftPreviewTabTransport.js';

// Send the current unpublished draft to a standalone tab without URL payloads,
// browser storage, public-page API calls, or changing editor save state.
// This callback factory is deliberately callable from non-React QA.
export function usePreviewWindow({ showToast }) {
  const pending = new Set();

  const openPreview = () => {
    if (typeof window === 'undefined') return;
    const draft = getEditorDraftPreviewPage();
    if (!draft || !Array.isArray(draft.blocks)) {
      showToast?.('편집 중인 페이지를 찾지 못했습니다. 페이지를 다시 선택해주세요.', 'warning');
      return;
    }

    // Do not silently open an older published URL in place of this draft.
    if (typeof BroadcastChannel === 'undefined' || !window.crypto?.randomUUID) {
      showToast?.('이 브라우저는 미발행 초안 미리보기를 지원하지 않습니다.', 'warning');
      return;
    }

    let channel;
    let token;
    try {
      token = window.crypto.randomUUID();
      channel = new BroadcastChannel(draftPreviewChannelName(token));
    } catch {
      showToast?.('새 탭 미리보기 연결을 시작하지 못했습니다.', 'warning');
      return;
    }

    let expiry;
    let finished = false;
    let receiverReady = false;
    const close = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(expiry);
      channel.close();
      pending.delete(close);
    };
    channel.onmessage = (event) => {
      if (finished || event.data?.token !== token) return;
      if (event.data?.type === 'ready') {
        receiverReady = true;
        try {
          channel.postMessage({ type: 'draft', token, page: draft });
        } catch {
          close();
          showToast?.('새 탭으로 초안을 전달하지 못했습니다. 다시 열어주세요.', 'error');
        }
      } else if (event.data?.type === 'received') {
        close();
      }
    };
    pending.add(close);
    expiry = window.setTimeout(() => {
      if (finished) return;
      close();
      showToast?.(
        receiverReady
          ? '새 탭이 미리보기 데이터를 받지 못했습니다. 편집기에서 다시 열어주세요.'
          : '미리보기 새 탭에 연결되지 않았습니다. 팝업 차단 설정을 확인하고 다시 열어주세요.',
        'warning',
      );
    }, 22000);

    try {
      // Browsers may return null even after successfully opening a noopener tab.
      // Only the ready/received handshake proves delivery; do not treat a null
      // return value as proof that a popup was blocked.
      window.open(draftPreviewTabUrl(token, window.location.origin), '_blank', 'noopener,noreferrer');
    } catch {
      close();
      showToast?.('새 탭을 열지 못했습니다. 팝업 차단 설정을 확인해주세요.', 'warning');
    }
  };

  return { openPreview };
}
