const C63_HOME_HTML = `<!doctype html>
<html lang="ko" translate="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google" content="notranslate" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <title>페이지로</title>
  <script type="module" crossorigin src="/c63-assets/index-pagero-main-fix-20260615.js"></script>
  <link rel="modulepreload" crossorigin href="/c63-assets/jsx-runtime-BHwPObl3.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/createLucideIcon-Bx4O1Xry.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/blockButtons-B4yj58nD.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/conversionTracking-DRYdd-AP.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/apiClient-BH--T1pK.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/pageSlugs-B_AGvkn1.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/projectContext-Df7NZjeN.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/linkPreview-DHfzyAx0.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/pageModel-DiUX99-Q.js">
  <link rel="modulepreload" crossorigin href="/c63-assets/monthRange-D959kZuv.js">
  <link rel="stylesheet" crossorigin href="/c63-assets/index-B0Q5rFVf.css">
  <style>
    #root > .pagero-exact-home ~ .pagero-exact-home {
      display: none !important;
    }
    .pagero-exact-home .c63-login-btn {
      border: 1px solid rgba(15, 23, 42, .16);
      background: rgba(255, 255, 255, .9);
      color: #0f172a;
      border-radius: 999px;
      min-height: 44px;
      padding: 0 18px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }
    .pagero-exact-home .nav > .c63-login-btn {
      margin-left: auto;
    }
    .pagero-exact-home .nav > .c63-login-btn + .header-btn {
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <script>
    (() => {
      const removeChild = Node.prototype.removeChild;
      const insertBefore = Node.prototype.insertBefore;
      Node.prototype.removeChild = function safeRemoveChild(child) {
        if (child && child.parentNode !== this) return child;
        return removeChild.call(this, child);
      };
      Node.prototype.insertBefore = function safeInsertBefore(node, before) {
        if (before && before.parentNode !== this) return this.appendChild(node);
        return insertBefore.call(this, node, before);
      };
      const removeDuplicateHomes = () => {
        const root = document.getElementById('root');
        if (!root) return;
        const homes = Array.from(root.children).filter((node) => node.classList?.contains('pagero-exact-home'));
        homes.slice(1).forEach((node) => node.remove());
      };
      const removeDuplicateFooters = () => {
        const root = document.getElementById('root');
        if (!root) return;
        const home = root.querySelector('.pagero-exact-home');
        if (!home) return;
        const footers = Array.from(home.querySelectorAll('footer'));
        footers.slice(0, -1).forEach((node) => node.remove());
      };
      const goLogin = () => {
        window.location.assign('/login');
      };
      const isLoginTarget = (node) => {
        if (!node) return false;
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        return node.classList?.contains('c63-login-btn')
          || text === '로그인'
          || text === '바로 시작하기'
          || text === '무료 시작'
          || text === '무료로 시작하기';
      };
      const makeLoginButton = (variant) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'c63-login-btn c63-login-btn-' + variant;
        button.textContent = '로그인';
        button.setAttribute('aria-label', '로그인');
        return button;
      };
      const installLoginBridge = () => {
        const root = document.getElementById('root');
        if (!root) return;
        if (!root.__pageroC63LoginBridgeInstalled) {
          Object.defineProperty(root, '__pageroC63LoginBridgeInstalled', { value: true });
          root.addEventListener('click', (event) => {
            const target = event.target?.closest?.('button, a');
            if (!isLoginTarget(target)) return;
            event.preventDefault();
            event.stopPropagation();
            goLogin();
          }, true);
        }
        const nav = root.querySelector('.pagero-exact-home .header .nav');
        if (nav && !nav.querySelector('.c63-login-btn-header')) {
          const startButton = nav.querySelector('.header-btn');
          const loginButton = makeLoginButton('header');
          nav.insertBefore(loginButton, startButton || null);
        }
      };
      const installHomeGuard = () => {
        const root = document.getElementById('root');
        if (!root || root.__pageroC63HomeGuardInstalled) return;
        Object.defineProperty(root, '__pageroC63HomeGuardInstalled', { value: true });
        new MutationObserver(() => {
          removeDuplicateHomes();
          removeDuplicateFooters();
          installLoginBridge();
        }).observe(root, { childList: true, subtree: true });
        removeDuplicateHomes();
        removeDuplicateFooters();
        installLoginBridge();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installHomeGuard, { once: true });
      } else {
        installHomeGuard();
      }
    })();
  </script>
  <div id="root"></div>
</body>
</html>
`;

export function onRequest() {
  return new Response(C63_HOME_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
