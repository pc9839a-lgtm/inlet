import React from 'react';
import { EVENTS_KEY, LEADS_KEY, START_MODE_KEY, STORAGE_KEY } from '../config/storageKeys.js';

const ROOT_CHUNK_RELOAD_KEY = 'pagero-root-chunk-reload';
const ROOT_CHUNK_RELOAD_LIMIT = 1;

function isLazyChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(message);
}

async function clearBrowserRuntimeCaches() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {}
}

function freshReloadScope() {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete('__fresh');
  return `${url.pathname}${url.search}`;
}

function replaceWithFreshRuntime() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('__fresh', String(Date.now()));
  window.location.replace(url.toString());
}

function recoverRootChunkLoad(error) {
  if (!isLazyChunkLoadError(error) || typeof window === 'undefined') return false;
  const key = `${ROOT_CHUNK_RELOAD_KEY}:${freshReloadScope()}`;
  const attempts = Number(window.sessionStorage?.getItem(key) || 0);
  if (attempts >= ROOT_CHUNK_RELOAD_LIMIT) return false;
  try {
    window.sessionStorage?.setItem(key, String(attempts + 1));
  } catch {}
  clearBrowserRuntimeCaches().finally(replaceWithFreshRuntime);
  return true;
}

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (recoverRootChunkLoad(error)) {
      this.setState({ recovering: true });
      return;
    }
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.recovering) {
      return (
        <div className="error-screen error-screen-v2">
          <div>
            <h1>최신 화면으로 이동합니다.</h1>
            <p>배포 후 남은 캐시를 정리하고 있습니다.</p>
          </div>
        </div>
      );
    }
    if (!this.state.error) return this.props.children;
    const cleanMessage = String(this.state.error?.message || this.state.error || '알 수 없는 오류');

    return (
      <div className="error-screen error-screen-v2">
        <div>
          <h1>화면을 불러오는 중 오류가 발생했습니다.</h1>
          <p>{cleanMessage}</p>
          <div className="error-actions">
            <button type="button" onClick={() => location.reload()}>다시 열기</button>
            <button type="button" onClick={() => { localStorage.removeItem(STORAGE_KEY); location.reload(); }}>페이지 설정만 초기화</button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(LEADS_KEY);
                localStorage.removeItem(EVENTS_KEY);
                localStorage.removeItem(START_MODE_KEY);
                location.reload();
              }}
            >
              전체 초기화
            </button>
          </div>
        </div>
      </div>
    );

    if (this.state.recovering) {
      return (
        <div className="error-screen error-screen-v2">
          <div>
            <h1>최신 화면으로 이동합니다.</h1>
            <p>배포 후 남은 캐시를 정리하고 있습니다.</p>
          </div>
        </div>
      );
    }
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || this.state.error || '알 수 없는 오류');

    return (
      <div className="error-screen error-screen-v2">
        <div>
          <h1>화면을 불러오는 중 오류가 발생했습니다.</h1>
          <p>{message}</p>
          <div className="error-actions">
            <button onClick={() => location.reload()}>다시 열기</button>
            <button onClick={() => { localStorage.removeItem(STORAGE_KEY); location.reload(); }}>페이지 설정만 초기화</button>
            <button
              className="danger"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(LEADS_KEY);
                localStorage.removeItem(EVENTS_KEY);
                localStorage.removeItem(START_MODE_KEY);
                location.reload();
              }}
            >
              전체 초기화
            </button>
          </div>
        </div>
      </div>
    );
  }
}
