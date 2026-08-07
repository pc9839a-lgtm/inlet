import React from 'react';
import { EVENTS_KEY, LEADS_KEY, START_MODE_KEY, STORAGE_KEY } from '../config/storageKeys.js';

const ROOT_CHUNK_RELOAD_KEY = 'pagero-root-chunk-reload-v3';
const ROOT_CHUNK_RELOAD_LIMIT = 3;
const ROOT_CHUNK_RELOAD_WINDOW_MS = 45000;
const ROOT_CHUNK_RELOAD_RESET_MS = 60000;
const RUNTIME_RECOVERY_KEYS = ['pagero-runtime-recovery-v1'];

function isLazyChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError|Unexpected token '<'|Failed to load module script|Unable to preload CSS|MIME type|Importing CSS chunk/i.test(message);
}

async function clearBrowserRuntimeCaches() {
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {}
  }
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    } catch {}
  }
}

function freshReloadScope() {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  ['__fresh', '__runtime', '__runtimefix'].forEach((key) => url.searchParams.delete(key));
  return `${url.pathname}${url.search}`;
}

function chunkErrorFingerprint(error) {
  const message = String(error?.message || error || 'unknown-chunk-error');
  const asset = message.match(/(?:https?:\/\/[^\s"']+)?\/assets\/[^\s"')]+\.(?:js|css)(?:\?[^\s"')]+)?/i)?.[0] || message.slice(0, 240);
  let hash = 2166136261;
  for (let index = 0; index < asset.length; index += 1) {
    hash ^= asset.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function rootChunkReloadKey(error) {
  return `${ROOT_CHUNK_RELOAD_KEY}:${freshReloadScope()}:${chunkErrorFingerprint(error)}`;
}

function clearRuntimeRecoveryMarkers() {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (
        key?.startsWith(`${ROOT_CHUNK_RELOAD_KEY}:`)
        || key?.startsWith('pagero-root-chunk-reload-v2:')
        || key?.startsWith('pagero-root-chunk-reload:')
        || key?.startsWith('pagero-chunk-reload-v5:')
        || RUNTIME_RECOVERY_KEYS.includes(key)
      ) {
        storage.removeItem(key);
      }
    }
  } catch {}
}

function replaceWithFreshRuntime() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('__fresh');
  url.searchParams.delete('__runtime');
  url.searchParams.set('__runtimefix', String(Date.now()));
  window.location.replace(url.toString());
}

function forceFreshRuntime() {
  clearRuntimeRecoveryMarkers();
  clearBrowserRuntimeCaches().finally(replaceWithFreshRuntime);
}

function readRecoveryState(key) {
  try {
    const raw = window.sessionStorage?.getItem(key);
    if (!raw) return { attempts: 0, at: 0 };
    const parsed = JSON.parse(raw);
    return {
      attempts: Number(parsed?.attempts || 0),
      at: Number(parsed?.at || 0),
    };
  } catch {
    return { attempts: 0, at: 0 };
  }
}

function recoverRootChunkLoad(error) {
  if (!isLazyChunkLoadError(error) || typeof window === 'undefined') return false;
  const key = rootChunkReloadKey(error);
  const now = Date.now();
  const previous = readRecoveryState(key);
  const attempts = now - previous.at <= ROOT_CHUNK_RELOAD_WINDOW_MS ? previous.attempts : 0;
  if (attempts >= ROOT_CHUNK_RELOAD_LIMIT) return false;

  try {
    window.sessionStorage?.setItem(key, JSON.stringify({ attempts: attempts + 1, at: now }));
  } catch {}

  clearBrowserRuntimeCaches().finally(replaceWithFreshRuntime);
  return true;
}

function installVitePreloadRecovery() {
  if (typeof window === 'undefined' || window.__pageroVitePreloadRecoveryInstalled) return;
  Object.defineProperty(window, '__pageroVitePreloadRecoveryInstalled', {
    value: true,
    configurable: true,
  });
  window.addEventListener('vite:preloadError', (event) => {
    const error = event?.payload || event?.detail || event;
    if (!recoverRootChunkLoad(error)) return;
    event.preventDefault?.();
  });
}

installVitePreloadRecovery();

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
    this.recoveryResetTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    if (typeof window === 'undefined') return;
    this.recoveryResetTimer = window.setTimeout(() => {
      if (!this.state.error) clearRuntimeRecoveryMarkers();
      const url = new URL(window.location.href);
      if (url.searchParams.has('__runtimefix')) {
        url.searchParams.delete('__runtimefix');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }, ROOT_CHUNK_RELOAD_RESET_MS);
  }

  componentDidCatch(error, info) {
    if (this.recoveryResetTimer) window.clearTimeout(this.recoveryResetTimer);
    if (recoverRootChunkLoad(error)) {
      this.setState({ recovering: true });
      return;
    }
    console.error('Render error:', error, info);
  }

  componentWillUnmount() {
    if (this.recoveryResetTimer && typeof window !== 'undefined') {
      window.clearTimeout(this.recoveryResetTimer);
    }
  }

  render() {
    if (this.state.recovering) {
      return (
        <div className="error-screen error-screen-v2">
          <div>
            <h1>최신 화면으로 다시 연결 중입니다.</h1>
            <p>이전 배포 파일을 제거하고 현재 버전을 불러오고 있습니다.</p>
          </div>
        </div>
      );
    }
    if (!this.state.error) return this.props.children;

    const chunkError = isLazyChunkLoadError(this.state.error);
    if (chunkError) {
      return (
        <div className="error-screen error-screen-v2">
          <div>
            <h1>최신 버전 연결이 필요합니다.</h1>
            <p>브라우저에 남은 이전 배포 파일을 제거한 뒤 현재 버전으로 다시 연결합니다.</p>
            <div className="error-actions">
              <button type="button" onClick={forceFreshRuntime}>현재 버전 다시 열기</button>
            </div>
          </div>
        </div>
      );
    }

    const cleanMessage = String(this.state.error?.message || this.state.error || '알 수 없는 오류');
    return (
      <div className="error-screen error-screen-v2">
        <div>
          <h1>화면을 불러오는 중 오류가 발생했습니다.</h1>
          <p>{cleanMessage}</p>
          <div className="error-actions">
            <button type="button" onClick={forceFreshRuntime}>현재 버전 다시 열기</button>
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
  }
}
