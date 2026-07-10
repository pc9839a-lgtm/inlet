import { Component, Suspense } from 'react';

const CHUNK_RELOAD_KEY = 'pagero-chunk-reload-v6';
const CHUNK_RELOAD_LIMIT = 5;
function isLazyChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError|Unexpected token '<'|Failed to load module script|MIME type/i.test(message);
}

async function clearBrowserRuntimeCaches() {
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {}
  }
}

function replaceWithCanonicalRuntime() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('__fresh');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.location.replace(next || '/');
}

function resetChunkReloadAttempts() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.sessionStorage || {})
      .filter((key) => key.startsWith('pagero-chunk-reload-'))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
}

export function forceCanonicalRuntime() {
  resetChunkReloadAttempts();
  clearBrowserRuntimeCaches().finally(() => {
    replaceWithCanonicalRuntime();
  });
}

function chunkReloadScope() {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete('__fresh');
  return `${url.pathname}${url.search}`;
}

export function recoverLazyChunkLoad(error) {
  if (!isLazyChunkLoadError(error)) return false;
  if (typeof window === 'undefined') return false;
  const reloadKey = `${CHUNK_RELOAD_KEY}:${chunkReloadScope()}`;
  const attempts = Number(window.sessionStorage?.getItem(reloadKey) || 0);
  if (attempts >= CHUNK_RELOAD_LIMIT) return false;
  try {
    window.sessionStorage?.setItem(reloadKey, String(attempts + 1));
  } catch {}
  clearBrowserRuntimeCaches().finally(() => {
    replaceWithCanonicalRuntime();
  });
  return true;
}

export function LazyPanelFallback() {
  return <section className="card"><div className="section-title"><h2>Loading screen...</h2></div></section>;
}

export function LazyPreviewFallback({ recovering = false }) {
  return (
    <div className="preview-runtime-fallback">
      <strong>{recovering ? 'Moving to the latest screen.' : 'Loading the screen failed.'}</strong>
      {!recovering && <button type="button" onClick={forceCanonicalRuntime}>Open latest screen</button>}
    </div>
  );
}

export class LazyChunkBoundary extends Component {
  state = { error: null, recovering: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (this.props.variant !== 'preview' && recoverLazyChunkLoad(error)) {
      this.setState({ recovering: true });
      return;
    }
    console.warn('Lazy chunk load failed:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, recovering: false });
    }
  }

  render() {
    if (this.state.recovering) {
      return this.props.variant === 'preview' ? <LazyPreviewFallback recovering /> : <LazyPanelFallback />;
    }
    if (this.state.error) {
      if (this.props.variant === 'preview') {
        return <LazyPreviewFallback />;
      }
      return (
        <section className="card">
          <div className="section-title">
            <h2>Loading screen failed.</h2>
            <p>Clear the stale runtime cache and open the latest screen.</p>
          </div>
          <button type="button" className="save-connection-btn" onClick={forceCanonicalRuntime}>Open latest screen</button>
        </section>
      );
    }
    return this.props.children;
  }
}

export function LazyEditorFallback() {
  return <div className="muted small">Loading editor...</div>;
}

export function renderLazyEditor(Editor, props) {
  return (
    <LazyEditorBoundary resetKey={props?.s?.anchorId || props?.s?.title || ''}>
      <Suspense fallback={<LazyEditorFallback />}>
        <Editor {...props} />
      </Suspense>
    </LazyEditorBoundary>
  );
}

export class LazyEditorBoundary extends Component {
  state = { error: null, recovering: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (recoverLazyChunkLoad(error)) {
      this.setState({ recovering: true });
      return;
    }
    console.warn('Fixed block editor load failed:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, recovering: false });
    }
  }

  render() {
    if (this.state.recovering) {
      return <div className="muted small" role="status">최신 편집기를 다시 불러오는 중입니다.</div>;
    }
    if (this.state.error) {
      return (
        <div className="muted small lazy-editor-error" role="alert">
          <span>편집기를 불러오지 못했습니다.</span>
          <button type="button" onClick={forceCanonicalRuntime}>다시 불러오기</button>
        </div>
      );
    }

    return this.props.children;
  }
}
