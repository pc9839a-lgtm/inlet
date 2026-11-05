import { useEffect, useState } from 'react';
import PreviewRenderer from './LandingRenderer.jsx';
import { draftPreviewChannelName, validDraftPreviewToken } from '../runtime/draftPreviewTabTransport.js';
import './DraftPreviewTab.css';

// A tab-only view of the editor's current unsaved page. No authentication,
// saving, publishing, lead delivery, or modal overlay happens in this view.
export default function DraftPreviewTab({ token }) {
  const [state, setState] = useState({ page: null, error: '' });

  useEffect(() => {
    if (!validDraftPreviewToken(token) || typeof BroadcastChannel === 'undefined') {
      setState({ page: null, error: '미리보기를 불러올 수 없습니다. 편집기에서 다시 열어주세요.' });
      return undefined;
    }

    let channel;
    try {
      channel = new BroadcastChannel(draftPreviewChannelName(token));
    } catch {
      setState({ page: null, error: '새 탭 미리보기 연결을 만들 수 없습니다. 편집기에서 다시 열어주세요.' });
      return undefined;
    }
    let finished = false;
    const request = () => {
      if (finished) return;
      try { channel.postMessage({ type: 'ready', token }); }
      catch {
        finished = true;
        setState({ page: null, error: '미리보기 연결이 끊어졌습니다. 편집기에서 다시 열어주세요.' });
        window.clearInterval(retry);
        window.clearTimeout(expiry);
        channel.close();
      }
    };
    channel.onmessage = (event) => {
      const message = event.data;
      if (finished || message?.type !== 'draft' || message?.token !== token
        || !message.page || !Array.isArray(message.page.blocks)) return;
      finished = true;
      setState({ page: message.page, error: '' });
      try { channel.postMessage({ type: 'received', token }); }
      catch { /* The draft has already been received in this tab. */ }
      window.clearInterval(retry);
      window.clearTimeout(expiry);
      channel.close();
    };

    const retry = window.setInterval(request, 300);
    const expiry = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      setState({ page: null, error: '미리보기 연결이 만료됐습니다. 편집기에서 다시 열어주세요.' });
      window.clearInterval(retry);
      channel.close();
    }, 20000);
    request();

    return () => {
      finished = true;
      window.clearInterval(retry);
      window.clearTimeout(expiry);
      channel.close();
    };
  }, [token]);

  useEffect(() => {
    document.title = '페이지로 미리보기';
  }, []);

  return (
    <main className="pagero-draft-preview-tab">
      {state.page ? (
        <div className="phone-frame pagero-draft-preview-content">
          <PreviewRenderer page={state.page} leads={[]} editorPreview />
        </div>
      ) : (
        <p role="status" className="pagero-draft-preview-message">
          {state.error || '미리보기를 불러오는 중입니다.'}
        </p>
      )}
    </main>
  );
}
