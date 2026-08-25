const ROOT_TITLE = '페이지로 | 모바일 랜딩페이지 제작·접수 관리';
const ROOT_DESCRIPTION = '페이지로(PAGERO)는 상담 신청, 방문 예약, 견적 문의, 이벤트 접수용 모바일 랜딩페이지를 만들고 접수 내역과 전환 통계까지 한곳에서 관리하는 웹 기반 제작·운영 서비스입니다.';
const ROOT_CANONICAL = 'https://pagero.kr/';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPageroRoot(url) {
  const host = String(url?.hostname || '').toLowerCase();
  const path = String(url?.pathname || '/').replace(/\/+$/, '') || '/';
  const isPlatformHost = host === 'pagero.kr'
    || host === 'www.pagero.kr'
    || host.endsWith('.pages.dev')
    || host === 'localhost'
    || host.endsWith('.localhost');
  return isPlatformHost && path === '/';
}

function replaceOrInject(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(/<\/head>/i, `${replacement}\n</head>`);
}

function rootStructuredData() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://pagero.kr/#organization',
        name: '페이지로',
        alternateName: 'PAGERO',
        url: ROOT_CANONICAL,
        description: '모바일 랜딩페이지 제작과 상담·예약·견적·이벤트 접수 운영을 지원하는 웹 서비스',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://pagero.kr/#website',
        name: '페이지로',
        alternateName: 'PAGERO',
        url: ROOT_CANONICAL,
        inLanguage: 'ko-KR',
        publisher: { '@id': 'https://pagero.kr/#organization' },
      },
      {
        '@type': 'WebApplication',
        '@id': 'https://pagero.kr/#app',
        name: '페이지로',
        alternateName: 'PAGERO',
        url: ROOT_CANONICAL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'ko-KR',
        description: ROOT_DESCRIPTION,
        provider: { '@id': 'https://pagero.kr/#organization' },
      },
      {
        '@type': 'WebPage',
        '@id': 'https://pagero.kr/#webpage',
        url: ROOT_CANONICAL,
        name: ROOT_TITLE,
        description: ROOT_DESCRIPTION,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': 'https://pagero.kr/#website' },
        about: { '@id': 'https://pagero.kr/#app' },
      },
    ],
  });
}

function rootHeadTags() {
  return [
    '<!-- PAGERO_ROOT_SEO_V1 -->',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="ko_KR">',
    '<meta property="og:site_name" content="페이지로">',
    `<meta property="og:title" content="${escapeHtml(ROOT_TITLE)}">`,
    `<meta property="og:description" content="${escapeHtml(ROOT_DESCRIPTION)}">`,
    `<meta property="og:url" content="${ROOT_CANONICAL}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(ROOT_TITLE)}">`,
    `<meta name="twitter:description" content="${escapeHtml(ROOT_DESCRIPTION)}">`,
    `<script type="application/ld+json">${rootStructuredData()}</script>`,
  ].join('\n');
}

function enrichRootFallback(html) {
  const heroBefore = '<small>모바일 랜딩페이지 제작 도구</small><h1>모바일 페이지를 빠르게 만들고 접수까지 관리하세요.</h1><p>페이지로는 상담 신청, 방문 예약, 견적 문의, 이벤트 접수용 모바일 랜딩페이지를 만들고 접수 내용과 전환 통계를 관리할 수 있는 웹 기반 제작·운영 서비스입니다.</p>';
  const heroAfter = '<small>모바일 랜딩페이지 제작·운영 서비스</small><h1>페이지로 - 모바일 랜딩페이지 제작과 접수 관리</h1><p>페이지로(PAGERO)는 상담 신청, 방문 예약, 견적 문의, 이벤트 접수용 모바일 랜딩페이지를 빠르게 만들고, 접수 내역과 페이지 방문·버튼 클릭·문의 전환 통계까지 한곳에서 관리할 수 있는 웹 기반 제작·운영 서비스입니다.</p>';
  let next = html.replace(heroBefore, heroAfter);

  const lifeStart = '<section class="pagero-ssr-life"><h2>생활에 필요한 정보를 한곳에</h2>';
  if (next.includes(lifeStart) && !next.includes('페이지로는 어떤 서비스인가요?')) {
    const brandSection = '<section class="pagero-ssr-life"><h2>페이지로는 어떤 서비스인가요?</h2><p>페이지로는 개발 지식이 없어도 모바일 중심 랜딩페이지를 제작하고 실제 문의 접수까지 운영할 수 있도록 만든 서비스입니다. 보험·병원·교육·행사·예약·상담처럼 고객의 연락처와 요청사항을 받아야 하는 업무에서 페이지 제작과 접수 관리를 따로 나누지 않고 한 흐름으로 사용할 수 있습니다.</p><div class="pagero-ssr-grid"><article class="pagero-ssr-card"><h2>노코드 페이지 제작</h2><p>텍스트, 이미지, 버튼, 신청폼을 조합해 모바일 화면에 맞는 랜딩페이지를 구성하고 공개할 수 있습니다.</p></article><article class="pagero-ssr-card"><h2>문의 접수 관리</h2><p>상담 신청과 예약·견적 요청을 페이지에서 받고 접수함에서 확인해 후속 업무로 이어갈 수 있습니다.</p></article><article class="pagero-ssr-card"><h2>전환 흐름 확인</h2><p>페이지 방문과 주요 버튼 클릭, 문의 전환 데이터를 확인해 어떤 페이지가 실제 접수로 이어지는지 파악할 수 있습니다.</p></article><article class="pagero-ssr-card"><h2>페이지로 브랜드</h2><p>페이지로(PAGERO)의 공식 웹사이트는 pagero.kr이며 서비스 소개, 이용 안내, 개인정보처리방침과 생활정보 콘텐츠를 같은 도메인에서 제공합니다.</p></article></div></section>';
    next = next.replace(lifeStart, `${brandSection}${lifeStart}`);
  }

  next = next.replace(/https:\/\/life\.pagero\.kr\//g, 'https://pagero.kr/life/');
  return next;
}

export async function injectPageroRootSeo(url, response) {
  if (!isPageroRoot(url) || !response?.ok) return response;
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  html = replaceOrInject(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(ROOT_TITLE)}</title>`);
  html = replaceOrInject(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(ROOT_DESCRIPTION)}">`);
  html = replaceOrInject(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${ROOT_CANONICAL}">`);
  if (!html.includes('PAGERO_ROOT_SEO_V1')) html = html.replace(/<\/head>/i, `${rootHeadTags()}\n</head>`);
  html = enrichRootFallback(html);

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Pagero-Root-SEO', 'brand-entity-v1');
  headers.delete('Content-Length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
