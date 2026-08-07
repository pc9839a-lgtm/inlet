import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';
import MapEmbedApp from './map/MapEmbedApp.jsx';
import PublicHomeRoute from './screens/PublicHomeRoute.jsx';
import { installSplitPhoneInputs } from './lib/splitPhoneInputs.js';
import './styles.css';

const APP_QUERY_PARAMS = ['auth', 'code', 'state', 'session', 'token', 'provider', 'tab', 'mode', 'invite', 'admin'];

function isRootPublicHomeLocation(locationObject = window.location) {
  if (!locationObject) return false;
  const pathname = String(locationObject.pathname || '/').replace(/\/+$/, '') || '/';
  if (pathname !== '/') return false;
  const search = new URLSearchParams(locationObject.search || '');
  return !APP_QUERY_PARAMS.some((key) => search.has(key));
}

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

markPageAsNotranslate();
installDomMutationGuard();
installSplitPhoneInputs();

function PublicHomeEntry() {
  return (
    <PublicHomeRoute
      onLogin={() => { window.location.href = '/login'; }}
      onSignup={() => { window.location.href = '/signup'; }}
    />
  );
}

const root = createRoot(document.getElementById('root'));

if (window.location.pathname.startsWith('/embed/')) {
  root.render(<AppErrorBoundary><MapEmbedApp /></AppErrorBoundary>);
} else if (isRootPublicHomeLocation(window.location)) {
  root.render(<AppErrorBoundary><PublicHomeEntry /></AppErrorBoundary>);
} else {
  root.render(<AppErrorBoundary><App /></AppErrorBoundary>);
}
