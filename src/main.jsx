import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';
import MapEmbedApp from './map/MapEmbedApp.jsx';
import { installSplitPhoneInputs } from './lib/splitPhoneInputs.js';
import './styles.css';

const LEGACY_CHUNK_RELOAD_PREFIX = 'pagero-chunk-reload-v5:';
const RUNTIME_RECOVERY_KEY = 'pagero-runtime-recovery-v1';
const RUNTIME_STABLE_RESET_MS = 3000;

function markPageAsNotranslate() {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  document.body?.setAttribute('translate', 'no');
  document.body?.classList.add('notranslate');
  if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }
}

function installDomMutationGuard() {
  if (typeof Node === 'undefined' || Node.prototype.__pageroDomGuardInstalled) return;
  const originalRemoveChild = Node.prototype.removeChild;
  const originalInsertBefore = Node.prototype.insertBefore;

  Object.defineProperty(Node.prototype, '__pageroDomGuardInstalled', {
    value: true,
    configurable: true,
  });

  Node.prototype.removeChild = function removeChildGuard(child) {
    if (child && child.parentNode !== this) {
      if (child.parentNode) return originalRemoveChild.call(child.parentNode, child);
      return child;
    }
    return originalRemoveChild.call(this, child);
  };

  Node.prototype.insertBefore = function insertBeforeGuard(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode);
    }
    return originalInsertBefore.call(this, newNode, referenceNode);
  };
}

function runtimeAssetFailure(value) {
  const message = String(value?.message || value?.reason?.message || value?.reason || value || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError|Unable to preload CSS|Failed to load module script|MIME type/i.test(message);
}

async function clearRuntimeCaches() {
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {}
  }
}

function clearLegacyChunkReloadMarkers() {
  try {
    Object.keys(window.sessionStorage || {})
      .filter((key) => key.startsWith(LEGACY_CHUNK_RELOAD_PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
}

function runtimeRecoveryScope() {
  const url = new URL(window.location.href);
  url.searchParams.delete('__fresh');
  url.searchParams.delete('__runtime');
  return `${url.pathname}${url.search}`;
}

function recoverRuntimeAssetFailure(value) {
  if (!runtimeAssetFailure(value) || window.__pageroRuntimeRecovering) return false;
  const now = Date.now();
  const scope = runtimeRecoveryScope();
  let previous = null;
  try {
    previous = JSON.parse(window.sessionStorage?.getItem(RUNTIME_RECOVERY_KEY) || 'null');
  } catch {}
  const sameBurst = previous?.scope === scope && now - Number(previous?.at || 0) < 30000;
  const attempts = sameBurst ? Number(previous?.attempts || 0) : 0;
  if (attempts >= 2) return false;

  window.__pageroRuntimeRecovering = true;
  try {
    window.sessionStorage?.setItem(RUNTIME_RECOVERY_KEY, JSON.stringify({ scope, at: now, attempts: attempts + 1 }));
  } catch {}

  clearRuntimeCaches().finally(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('__runtime', String(now));
    window.location.replace(url.toString());
  });
  return true;
}

function installVisualViewportContract() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const viewport = window.visualViewport;
  const rootStyle = document.documentElement.style;

  const update = () => {
    const visibleHeight = Math.max(1, Math.round(viewport?.height || window.innerHeight || 1));
    const layoutHeight = Math.max(visibleHeight, Math.round(window.innerHeight || visibleHeight));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const keyboardInset = Math.max(0, layoutHeight - visibleHeight - offsetTop);
    rootStyle.setProperty('--pagero-visual-viewport-height', `${visibleHeight}px`);
    rootStyle.setProperty('--pagero-keyboard-inset', `${keyboardInset}px`);
  };

  update();
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('orientationchange', update, { passive: true });
  viewport?.addEventListener('resize', update, { passive: true });
  viewport?.addEventListener('scroll', update, { passive: true });
}

function installRuntimeRecovery() {
  window.addEventListener('error', (event) => {
    recoverRuntimeAssetFailure(event?.error || event?.message || event?.target?.src || '');
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    recoverRuntimeAssetFailure(event?.reason || '');
  });

  window.setTimeout(() => {
    clearLegacyChunkReloadMarkers();
    try {
      window.sessionStorage?.removeItem(RUNTIME_RECOVERY_KEY);
    } catch {}
    const url = new URL(window.location.href);
    if (url.searchParams.has('__fresh') || url.searchParams.has('__runtime')) {
      url.searchParams.delete('__fresh');
      url.searchParams.delete('__runtime');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, RUNTIME_STABLE_RESET_MS);
}

markPageAsNotranslate();
installDomMutationGuard();
installRuntimeRecovery();
installVisualViewportContract();
installSplitPhoneInputs();

const root = createRoot(document.getElementById('root'));

async function renderWorkspaceApp() {
  try {
    await import('./app-styles.css');
  } catch (error) {
    if (recoverRuntimeAssetFailure(error)) return;
    throw error;
  }
  root.render(<AppErrorBoundary><App /></AppErrorBoundary>);
}

if (window.location.pathname.startsWith('/embed/')) {
  root.render(<AppErrorBoundary><MapEmbedApp /></AppErrorBoundary>);
} else {
  void renderWorkspaceApp();
}
