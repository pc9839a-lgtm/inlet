const ROOT_SEO = Object.freeze({
  title: '페이지로 | 모바일 랜딩페이지 제작 도구',
  description: '페이지로는 상담 신청, 방문 예약, 견적 문의, 이벤트 접수용 모바일 랜딩페이지를 빠르게 제작하고 운영할 수 있는 노코드 페이지 제작 도구입니다.',
  canonical: 'https://pagero.kr/',
  naverVerification: '2b53120b247214ee096be40c7c15795e42a8a24c',
});

function rootSeoMarkup() {
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '페이지로',
    url: ROOT_SEO.canonical,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: ROOT_SEO.description,
  });

  return `
  <meta name="description" content="${ROOT_SEO.description}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="naver-site-verification" content="${ROOT_SEO.naverVerification}">
  <link rel="canonical" href="${ROOT_SEO.canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="페이지로">
  <meta property="og:title" content="${ROOT_SEO.title}">
  <meta property="og:description" content="${ROOT_SEO.description}">
  <meta property="og:url" content="${ROOT_SEO.canonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${ROOT_SEO.title}">
  <meta name="twitter:description" content="${ROOT_SEO.description}">
  <script type="application/ld+json" data-pagero-seo>${structuredData}</script>`;
}

function redirectWwwToApex(requestUrl) {
  const target = new URL(requestUrl.toString());
  target.hostname = 'pagero.kr';
  target.protocol = 'https:';
  target.port = '';
  return Response.redirect(target.toString(), 301);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.toLowerCase() === 'www.pagero.kr') {
    return redirectWwwToApex(url);
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (
    context.request.method !== 'GET'
    || url.pathname !== '/'
    || !contentType.toLowerCase().includes('text/html')
  ) {
    return response;
  }

  return new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(ROOT_SEO.title);
      },
    })
    .on('head', {
      element(element) {
        element.append(rootSeoMarkup(), { html: true });
      },
    })
    .transform(response);
}
