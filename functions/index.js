const PAGERO_HOME_HTML = `<!doctype html>
<html lang="ko" translate="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google" content="notranslate" />
  <meta name="google-adsense-account" content="ca-pub-1906196934401001" />
  <meta name="naver-site-verification" content="2b53120b247214ee096be40c7c15795e42a8a24c" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="description" content="페이지로에서 모바일 랜딩페이지를 만들고 접수와 통계를 한곳에서 관리하세요." />
  <link rel="canonical" href="https://pagero.kr/" />
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
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname !== '/') return context.next();

  return new Response(PAGERO_HOME_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
