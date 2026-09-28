const C63_HOME_HTML = `<!doctype html>
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
  <link rel="stylesheet" crossorigin href="/c63-assets/index-B0Q5rFVf.css?v=20260928-mobile-root-v2">
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
    .pagero-ssr-fallback {
      box-sizing: border-box;
      min-height: 100vh;
      padding: 54px 24px 72px;
      background: #f7f9fc;
      color: #111827;
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pagero-ssr-fallback * { box-sizing: border-box; }
    .pagero-ssr-inner { width: min(1080px, 100%); margin: 0 auto; }
    .pagero-ssr-brand { display: inline-block; margin-bottom: 48px; color: #111827; font-size: 24px; font-weight: 950; text-decoration: none; }
    .pagero-ssr-hero { padding: 48px; border: 1px solid #e1e8f0; border-radius: 28px; background: #fff; }
    .pagero-ssr-hero small { color: #1677ff; font-weight: 900; }
    .pagero-ssr-hero h1 { margin: 12px 0 18px; font-size: clamp(36px, 6vw, 66px); line-height: 1.08; letter-spacing: -.055em; }
    .pagero-ssr-hero p { max-width: 760px; margin: 0; color: #596579; font-size: 18px; line-height: 1.75; }
    .pagero-ssr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
    .pagero-ssr-card { padding: 22px; border: 1px solid #e1e8f0; border-radius: 20px; background: #fff; }
    .pagero-ssr-card h2 { margin: 0 0 8px; font-size: 19px; }
    .pagero-ssr-card p { margin: 0; color: #667085; line-height: 1.65; }
    .pagero-ssr-life { margin-top: 64px; }
    .pagero-ssr-life h2 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); letter-spacing: -.04em; }
    .pagero-ssr-life > p { margin: 0 0 24px; color: #667085; line-height: 1.7; }
    .pagero-ssr-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .pagero-ssr-links a { display: block; padding: 18px; border: 1px solid #e1e8f0; border-radius: 18px; background: #fff; color: #111827; font-weight: 850; line-height: 1.5; text-decoration: none; }
    .pagero-ssr-footer { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 52px; padding-top: 24px; border-top: 1px solid #dfe6ee; }
    .pagero-ssr-footer a { color: #4b5563; font-weight: 750; text-decoration: none; }
    @media (max-width: 760px) {
      .pagero-exact-home {
        padding-bottom: 68px !important;
      }
      .pagero-exact-home .header {
        top: 8px !important;
      }
      .pagero-exact-home .header .nav {
        width: calc(100% - 20px) !important;
        height: 52px !important;
        min-height: 52px !important;
        padding: 0 7px 0 11px !important;
        border-radius: 18px !important;
        gap: 0 !important;
      }
      .pagero-exact-home .header .logo {
        gap: 7px !important;
        margin-right: 8px !important;
        font-size: 17px !important;
        letter-spacing: -.055em !important;
      }
      .pagero-exact-home .header .logo-mark {
        width: 26px !important;
        height: 26px !important;
        border-radius: 9px !important;
      }
      .pagero-exact-home .header .logo-mark::after {
        top: 5px !important;
        right: 5px !important;
        width: 8px !important;
        height: 8px !important;
      }
      .pagero-exact-home .header .menu {
        display: none !important;
      }
      .pagero-exact-home .nav > .c63-login-btn {
        min-height: 34px !important;
        height: 34px !important;
        margin-left: auto !important;
        padding: 0 10px !important;
        border-radius: 13px !important;
        font-size: 11px !important;
      }
      .pagero-exact-home .nav > .c63-login-btn + .header-btn {
        height: 34px !important;
        min-height: 34px !important;
        margin-left: 4px !important;
        padding: 0 10px !important;
        border-radius: 13px !important;
        font-size: 11px !important;
        box-shadow: none !important;
      }

      .pagero-exact-home .hero {
        min-height: auto !important;
        padding: 92px 0 52px !important;
        align-items: flex-start !important;
      }
      .pagero-exact-home .hero-title {
        font-size: clamp(38px, 11vw, 48px) !important;
        line-height: .96 !important;
        letter-spacing: -.075em !important;
      }
      .pagero-exact-home .hero-action {
        margin-top: 24px !important;
      }
      .pagero-exact-home .hero-preview {
        width: 100% !important;
        max-width: 330px !important;
        margin-top: 44px !important;
      }
      .pagero-exact-home .preview-main {
        width: 100% !important;
        height: 336px !important;
        padding: 28px 20px 18px !important;
        border-radius: 26px 26px 0 0 !important;
        animation: none !important;
      }

      .pagero-exact-home .section,
      .pagero-exact-home .feature-section,
      .pagero-exact-home .final-section {
        padding: 56px 0 !important;
      }
      .pagero-exact-home .section-title,
      .pagero-exact-home .left-title {
        font-size: clamp(32px, 9.5vw, 40px) !important;
        line-height: 1.02 !important;
        letter-spacing: -.065em !important;
      }

      .pagero-exact-home #leads .split {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 20px !important;
        align-items: start !important;
      }
      .pagero-exact-home #leads .left-title {
        max-width: 340px !important;
        margin-top: 12px !important;
      }
      .pagero-exact-home #leads .mock-zone {
        min-height: 0 !important;
        display: grid !important;
        gap: 10px !important;
        overflow: visible !important;
        isolation: auto !important;
      }
      .pagero-exact-home #leads .mock-zone::before,
      .pagero-exact-home #leads .mock-zone::after {
        display: none !important;
      }
      .pagero-exact-home #leads .form-phone,
      .pagero-exact-home #leads .inbox-panel {
        position: relative !important;
        inset: auto !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        width: 100% !important;
        transform: none !important;
        animation: none !important;
      }
      .pagero-exact-home #leads .form-phone {
        height: auto !important;
        min-height: 326px !important;
        padding: 18px !important;
        border-radius: 24px !important;
      }
      .pagero-exact-home #leads .inbox-panel {
        margin: 0 !important;
        padding: 18px !important;
        border-radius: 24px !important;
      }
      .pagero-exact-home #leads .mock-title {
        margin-bottom: 14px !important;
        font-size: 19px !important;
      }
      .pagero-exact-home #leads .input-box {
        height: 44px !important;
        margin-bottom: 10px !important;
        border-radius: 13px !important;
      }
      .pagero-exact-home #leads .submit-box {
        height: 48px !important;
        margin-top: 14px !important;
      }
      .pagero-exact-home #leads .lead-row {
        height: 46px !important;
        margin-top: 8px !important;
        padding: 0 13px !important;
        border-radius: 14px !important;
        font-size: 12px !important;
      }

      .pagero-exact-home .fixed-cta {
        bottom: max(8px, env(safe-area-inset-bottom)) !important;
      }
      .pagero-exact-home .fixed-inner {
        width: calc(100% - 20px) !important;
        height: 54px !important;
        padding: 5px !important;
        border-radius: 18px !important;
      }
      .pagero-exact-home .fixed-text {
        display: none !important;
      }
      .pagero-exact-home .fixed-btn {
        width: 100% !important;
        height: 44px !important;
        padding: 0 16px !important;
        border-radius: 14px !important;
        font-size: 14px !important;
        box-shadow: none !important;
      }

      .pagero-exact-home .footer {
        padding-bottom: 88px !important;
      }

      .pagero-ssr-fallback { padding: 28px 18px 56px; }
      .pagero-ssr-hero { padding: 30px 22px; }
      .pagero-ssr-grid, .pagero-ssr-links { grid-template-columns: 1fr; }
    }

    @media (max-width: 380px) {
      .pagero-exact-home .header .nav {
        width: calc(100% - 12px) !important;
        padding-left: 8px !important;
        padding-right: 5px !important;
      }
      .pagero-exact-home .header .logo {
        gap: 6px !important;
        margin-right: 5px !important;
        font-size: 16px !important;
      }
      .pagero-exact-home .nav > .c63-login-btn,
      .pagero-exact-home .nav > .c63-login-btn + .header-btn {
        padding: 0 8px !important;
        font-size: 10px !important;
      }
      .pagero-exact-home .hero-title {
        font-size: clamp(36px, 10.8vw, 42px) !important;
      }
      .pagero-exact-home .section-title,
      .pagero-exact-home .left-title {
        font-size: clamp(30px, 9.2vw, 36px) !important;
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
  <div id="root"><main class="pagero-ssr-fallback" aria-label="페이지로 서비스와 생활정보"><div class="pagero-ssr-inner"><a class="pagero-ssr-brand" href="/">페이지로</a><section class="pagero-ssr-hero"><small>모바일 랜딩페이지 제작 도구</small><h1>모바일 페이지를 빠르게 만들고 접수까지 관리하세요.</h1><p>페이지로는 상담 신청, 방문 예약, 견적 문의, 이벤트 접수용 모바일 랜딩페이지를 만들고 접수 내용과 전환 통계를 관리할 수 있는 웹 기반 제작·운영 서비스입니다.</p><div class="pagero-ssr-grid"><article class="pagero-ssr-card"><h2>상담·견적 접수</h2><p>이름, 연락처, 요청사항을 받는 모바일 폼을 구성하고 접수 내용을 관리합니다.</p></article><article class="pagero-ssr-card"><h2>방문·일정 예약</h2><p>날짜, 시간과 방문 정보를 받아 예약 흐름을 간단하게 만듭니다.</p></article><article class="pagero-ssr-card"><h2>이벤트 신청</h2><p>설명회, 체험단, 쿠폰과 프로모션 신청 페이지를 빠르게 제작합니다.</p></article><article class="pagero-ssr-card"><h2>운영과 통계</h2><p>페이지 방문, 버튼 클릭과 문의 전환을 확인해 운영에 활용합니다.</p></article></div></section><section class="pagero-ssr-life"><h2>생활에 필요한 정보를 한곳에</h2><p>페이지로가 운영하는 생활비서에서 자동차 행정과 정부지원 정책을 공식 출처와 확인일을 기준으로 정리합니다.</p><div class="pagero-ssr-links"><a href="https://life.pagero.kr/car/car-registration-certificate-reissue/">자동차등록증 재발급 온라인·방문 신청 방법</a><a href="https://life.pagero.kr/car/car-inspection-period/">자동차 검사기간 조회 방법과 검사 종류</a><a href="https://life.pagero.kr/support/early-scrappage-guide/">2026 노후차 조기폐차 지원 대상·신청 순서</a><a href="https://life.pagero.kr/support/national-learning-card-2026/">2026 국민내일배움카드 대상·지원한도·신청방법</a><a href="https://life.pagero.kr/support/basic-pension-2026/">2026 기초연금 대상·선정기준액·신청방법</a><a href="https://life.pagero.kr/support/housing-benefit-2026/">2026 주거급여 대상·소득기준·신청방법</a></div></section><footer class="pagero-ssr-footer"><a href="/about">페이지로 소개</a><a href="/contact">문의</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a><a href="https://life.pagero.kr/">생활비서 전체보기</a></footer></div></main></div>
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
