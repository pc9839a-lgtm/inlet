import { PUBLIC_HOME_MARKUP } from '../src/screens/publicHomeMarkup.js';

// The root is a real, publicly readable product page, not a frozen SPA bundle.
// Reuse exactly the same text as the JS-rendered public homepage.
const HOME_HTML = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="google-adsense-account" content="ca-pub-1906196934401001">
<meta name="naver-site-verification" content="2b53120b247214ee096be40c7c15795e42a8a24c">
<meta name="description" content="페이지로는 모바일 랜딩페이지 제작부터 상담 신청·방문 예약 접수, 접수함과 전환 통계까지 관리할 수 있는 웹 서비스입니다. 실제 사용 설명서와 광고 손익 계산기를 확인하세요.">
<link rel="canonical" href="https://pagero.kr/">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css">
<link rel="stylesheet" href="/home/marketing.css">
<title>페이지로 | 모바일 랜딩페이지 제작·접수 관리</title>
<script>
// Match the previous root behavior for existing authenticated sessions.
(function(){try{var auth=JSON.parse(localStorage.getItem('inlet-auth-v1')||'null');if(auth&&(auth.session||auth.email))location.replace('/app');}catch(e){}})();
</script>
</head><body><div id="root">${PUBLIC_HOME_MARKUP}</div></body></html>`;

export function onRequest() {
  return new Response(HOME_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Pagero-Public-Home': 'marketing-v1',
    },
  });
}
