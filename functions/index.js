const C63_HOME_HTML = `<!doctype html>
<html lang="ko" translate="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google" content="notranslate" />
  <meta name="google-adsense-account" content="ca-pub-1906196934401001" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1906196934401001" crossorigin="anonymous"></script>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <title>페이지로</title>
  <script>
    (() => {
      try {
        const auth = JSON.parse(localStorage.getItem('inlet-auth-v1') || 'null');
        if (auth && (auth.session || auth.email)) {
          document.documentElement.style.visibility = 'hidden';
          window.location.replace('/app');
        }
      } catch {}
    })();
  </script>
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
  <link rel="stylesheet" href="/c63-life-bridge.css">
  <script defer src="/c63-life-bridge.js"></script>
  <style>
    #root > .pagero-exact-home ~ .pagero-exact-home {
      display: none !important;
    }
    .pagero-exact-home .header .nav {
      display: flex !important;
      align-items: center !important;
      gap: 0 !important;
      width: min(1180px, calc(100% - 48px)) !important;
      margin-left: auto !important;
      margin-right: auto !important;
      min-width: 0 !important;
    }
    .pagero-exact-home .header .logo {
      flex: 0 0 auto !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 10px !important;
      margin-right: 24px !important;
      white-space: nowrap !important;
    }
    .pagero-exact-home .header .menu {
      flex: 0 1 auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 22px !important;
      min-width: 0 !important;
      margin: 0 !important;
    }
    .pagero-exact-home .header .menu a {
      display: inline-flex !important;
      align-items: center !important;
      white-space: nowrap !important;
      line-height: 1 !important;
      padding: 0 !important;
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
      flex: 0 0 auto !important;
      margin-left: auto !important;
    }
    .pagero-exact-home .nav > .c63-login-btn + .header-btn {
      flex: 0 0 auto !important;
      margin-left: 8px !important;
    }
    @media (max-width: 760px) {
      .pagero-exact-home .header .logo {
        margin-right: 18px !important;
      }
      .pagero-exact-home .header .menu {
        display: none !important;
      }
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
        window.location.replace('/login');
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
