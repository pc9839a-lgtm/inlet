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
      const installHomeGuard = () => {
        const root = document.getElementById('root');
        if (!root || root.__pageroC63HomeGuardInstalled) return;
        Object.defineProperty(root, '__pageroC63HomeGuardInstalled', { value: true });
        new MutationObserver(removeDuplicateHomes).observe(root, { childList: true });
        removeDuplicateHomes();
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
