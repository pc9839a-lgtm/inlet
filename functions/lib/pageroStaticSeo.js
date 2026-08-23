const ROOT_ORIGIN = 'https://pagero.kr';

const LIFE_LINKS = [
  ['/life/support/childcare-service-government-support-2026/', '2026 아이돌봄서비스 정부지원'],
  ['/life/support/basic-pension-2026/', '2026 기초연금'],
  ['/life/support/child-allowance-2026/', '2026 아동수당'],
  ['/life/car/car-inspection-period/', '자동차 검사기간 확인'],
  ['/life/car/traffic-fine-check-payment/', '교통 과태료 조회·납부'],
  ['/life/car/car-registration-certificate-reissue/', '자동차등록증 재발급'],
];

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanPath(pathname = '/') {
  const value = String(pathname || '/').replace(/\/+$/, '');
  return value || '/';
}

function isPageroSeoHost(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'pagero.kr'
    || host === 'www.pagero.kr'
    || host.endsWith('.pages.dev')
    || host === 'localhost'
    || host.endsWith('.localhost');
}

function nav() {
  return `<nav aria-label="페이지로 안내"><a href="/">홈</a><a href="/life/">생활비서</a><a href="/about">소개</a><a href="/contact">문의</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a></nav>`;
}

function shell({ eyebrow = '페이지로', title, intro = '', content = '' }) {
  return `<div data-pagero-seo-shell><div class="pagero-seo-wrap">${nav()}<main><p class="pagero-seo-eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${intro ? `<p class="pagero-seo-intro">${escapeHtml(intro)}</p>` : ''}${content}</main></div></div>`;
}

function section(title, body = '', items = []) {
  return `<section><h2>${escapeHtml(title)}</h2>${body ? `<p>${escapeHtml(body)}</p>` : ''}${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</section>`;
}

const HOME = {
  title: '페이지로 | 모바일 랜딩페이지 제작과 생활정보',
  description: '페이지로는 모바일 랜딩페이지 제작·문의 접수·운영 관리 기능과 자동차 행정·정부지원 생활정보를 제공합니다.',
  body: shell({
    eyebrow: '페이지로',
    title: '모바일 페이지를 빠르게 만드세요',
    intro: '페이지로는 모바일 랜딩페이지 제작, 문의 접수, 전환 확인과 운영 관리를 한 곳에서 처리할 수 있도록 만든 웹 기반 서비스입니다.',
    content: `${section('페이지로에서 할 수 있는 일', '', [
      '모바일 랜딩페이지 제작 및 수정',
      '상담·예약·견적·이벤트 신청 폼 구성',
      '접수된 문의와 리드 관리',
      '페이지 방문과 전환 통계 확인',
    ])}<section><h2>생활에 필요한 정보를 한곳에서 확인하세요</h2><p>생활비서는 자동차 행정과 정부지원·생활정책을 공식 자료와 확인일을 기준으로 정리하는 페이지로의 생활정보 영역입니다.</p><div class="pagero-seo-life-links">${LIFE_LINKS.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}</div><p><a href="/life/">생활비서 전체보기</a></p></section>`,
  }),
};

const ABOUT = {
  title: '페이지로 소개 | 페이지로',
  description: '페이지로가 제공하는 랜딩페이지 제작, 문의 접수, 전환 통계, 관리자 운영 기능을 소개합니다.',
  body: shell({
    eyebrow: '사이트 소개',
    title: '페이지로 소개',
    intro: '페이지로는 랜딩페이지 제작, 문의 접수, 전환 통계, 관리자 운영을 한 곳에서 처리할 수 있도록 만든 웹 기반 제작·운영 서비스입니다.',
    content: `${section('무엇을 제공하나요?', '', [
      '랜딩페이지 제작 및 수정',
      '문의 폼, 예약 폼, 상담 신청 폼 구성',
      '접수함, 리드 관리, CSV 내보내기',
      '페이지 방문, CTA 클릭, 전환 통계 확인',
      '관리자, 클라이언트, 매니저 권한 관리',
      'Google Sheets 등 외부 도구와의 접수 데이터 연동',
    ])}${section('서비스 운영 방향', '페이지로는 단순히 화면을 만드는 도구가 아니라, 광고 유입 이후 문의 접수와 운영 관리까지 이어지는 흐름을 빠르게 만들 수 있도록 설계되었습니다. 사용자는 페이지 문구, 이미지, 폼 항목, 연결 설정을 직접 수정할 수 있고 운영자는 접수 데이터와 통계를 확인할 수 있습니다.')}${section('안내', '서비스 내 일부 기능은 Google 계정 로그인, Google Sheets, 외부 이메일, 웹훅, 광고 추적 도구, 결제 또는 인증 서비스와 연결될 수 있습니다. 실제 제공 범위와 설정 가능 항목은 이용 중인 요금제, 운영 환경, 외부 서비스 정책에 따라 달라질 수 있습니다.')}`,
  }),
};

const CONTACT = {
  title: '문의하기 | 페이지로',
  description: '페이지로 서비스 도입, 랜딩페이지 제작, 접수함·통계·권한 관리와 관련한 문의 안내입니다.',
  body: shell({
    eyebrow: '문의 안내',
    title: '문의하기',
    intro: '페이지로 서비스 이용, 랜딩페이지 제작, 접수함·통계·권한 관리 설정과 관련해 궁금한 점이 있다면 아래 안내를 참고해 문의해주세요.',
    content: `${section('서비스 문의', '서비스 도입, 제작 의뢰, 기능 설정, 운영 지원이 필요한 경우 관리자에게 문의할 수 있습니다.')}${section('접수 경로', '공개 페이지의 문의 폼 또는 별도 안내받은 연락 채널을 통해 문의를 남길 수 있습니다. 접수된 문의는 운영자가 확인한 뒤 순차적으로 응대합니다.')}${section('안내', '기능 제공 범위, 결제 조건, 외부 연동 가능 여부는 이용 환경과 계약 조건에 따라 달라질 수 있으므로 실제 적용 전 최종 확인이 필요합니다.')}`,
  }),
};

const PRIVACY = {
  title: '개인정보처리방침 | 페이지로',
  description: '페이지로 서비스의 개인정보 수집, 이용, 보관, 파기 및 Google 사용자 데이터 처리 기준을 안내합니다.',
  body: shell({
    eyebrow: '정책 안내',
    title: '개인정보처리방침',
    intro: '페이지로는 서비스 제공, 문의 접수, 계정 관리, 운영 지원 및 사용자가 선택한 외부 연동 제공을 위해 필요한 범위의 개인정보를 수집·이용합니다. 본 페이지는 이용자에게 개인정보 수집, 이용, 보관, 파기 기준을 안내하기 위해 작성되었습니다.',
    content: `${section('1. 수집하는 개인정보 항목', '', [
      '이름 또는 담당자명',
      '이메일 주소',
      '휴대폰 번호 또는 연락처',
      '문의 내용 및 접수 폼 답변',
      '계정, 권한, 페이지 설정 정보',
      '접속 환경 정보(기기, 브라우저, 유입 경로, 페이지 URL 등)',
      'Google 로그인을 이용하는 경우 Google 계정 이메일 및 기본 프로필 정보',
      'Google Sheets 연동을 승인한 경우 승인한 Google Sheets 접근 권한, 스프레드시트 ID, 연결 계정 이메일, Google Sheets에 저장되는 접수 데이터',
    ])}${section('2. 개인정보 수집 목적', '', [
      '회원가입, 로그인, 본인 확인 및 계정 관리',
      '문의 접수 확인 및 상담 응대',
      '랜딩페이지 운영, 리드 관리, 통계 제공',
      '사용자가 페이지로에서 수집한 접수 데이터를 본인의 Google Sheets에 자동 저장',
      '결제, 계약, 서비스 이용 상태 확인',
      '중복 가입, 비정상 이용, 보안 사고 방지',
    ])}${section('3. Google 사용자 데이터 이용', '페이지로는 사용자가 Google Sheets 연동을 승인한 경우, 사용자가 지정한 Google 스프레드시트에 접수 데이터를 저장하기 위해 Google Sheets API를 사용합니다. 이 데이터는 사용자가 페이지로에서 수집한 접수 데이터를 본인의 Google Sheets에 자동 저장하기 위한 목적으로만 사용됩니다.')}${section('4. Google 데이터 보관 및 연결 해제', 'Google OAuth refresh token은 서버에 암호화하여 저장합니다. 사용자가 Google Sheets 연결을 해제하면 관련 토큰은 비활성화하거나 삭제합니다. 페이지로는 Google 사용자 데이터를 광고, 판매, 리타게팅, 신용평가 목적으로 사용하지 않습니다.')}${section('5. 보유 및 이용 기간', '수집된 개인정보는 서비스 제공 및 문의 응대 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다. 다만, 계약 이행, 분쟁 대응, 부정 이용 방지 또는 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관할 수 있습니다.')}${section('6. 제3자 제공', '페이지로는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자의 별도 동의가 있거나 법령에 따라 제공이 필요한 경우는 예외로 합니다.')}${section('7. 개인정보 처리 위탁', '원활한 서비스 제공을 위해 일부 업무를 외부 서비스에 위탁할 수 있습니다. 예: 호스팅, 데이터 저장, 이메일 발송, 결제 처리, 분석 도구, 고객 응대 도구, 사용자가 선택한 Google Sheets 연동 처리.')}${section('8. 이용자의 권리', '이용자는 언제든지 본인의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다.')}${section('9. 문의처', '개인정보 열람, 정정, 삭제, 처리정지 요청은 서비스 내 문의 채널 또는 관리자에게 접수할 수 있습니다. 문의 이메일: support@pagero.kr')}`,
  }),
};

const TERMS = {
  title: '이용약관 | 페이지로',
  description: '페이지로 서비스 이용과 관련한 서비스 제공자와 이용자의 기본 권리와 의무를 안내합니다.',
  body: shell({
    eyebrow: '정책 안내',
    title: '이용약관',
    intro: '본 약관은 페이지로 서비스 이용과 관련하여 서비스 제공자와 이용자 간의 기본적인 권리와 의무를 정리한 문서입니다.',
    content: `${section('1. 서비스 목적', '페이지로는 랜딩페이지 제작, 폼 접수, 리드 관리, 통계 확인, 권한 관리, 외부 연동 설정 등 온라인 마케팅 운영에 필요한 기능 제공을 목적으로 운영됩니다.')}${section('2. 제공 정보의 성격', '서비스 화면, 템플릿, 통계, 예시 문구, 자동 생성 결과는 이용자의 제작과 운영을 돕기 위한 참고 자료입니다. 실제 광고 집행, 고객 응대, 계약, 결제, 법적 고지는 이용자가 최종 확인하고 책임져야 합니다.')}${section('3. 이용자의 책임', '', [
      '허위 정보 입력 금지',
      '타인의 개인정보 또는 계정 도용 금지',
      '권한 없는 페이지 접근 또는 데이터 열람 금지',
      '서비스 운영을 방해하는 행위 금지',
      '불법·허위·과장 광고 목적의 사용 금지',
    ])}${section('4. 저작권', '서비스 내 UI, 코드, 템플릿, 디자인 구성 등 자체 제작 콘텐츠의 저작권은 페이지로 또는 정당한 권리자에게 있습니다. 이용자가 업로드한 문구, 이미지, 고객 데이터의 권리와 책임은 해당 이용자에게 있습니다.')}${section('5. 외부 링크 및 제휴 안내', '서비스에는 Google 로그인, Google Sheets, 이메일, 웹훅, 광고 추적 도구, 결제, 인증, 외부 링크 등 제3자 서비스 연결 기능이 포함될 수 있습니다. 외부 서비스 이용 시 해당 서비스의 약관과 정책이 별도로 적용됩니다.')}${section('6. 면책 조항', '페이지로는 안정적인 서비스 제공을 위해 노력하지만, 외부 서비스 장애, 네트워크 문제, 이용자 설정 오류, 브라우저 또는 기기 환경에 따라 일부 기능 이용이 제한될 수 있습니다. 이용자는 공개 전 페이지 내용, 폼 항목, 개인정보 고지, 광고 추적 설정을 직접 확인해야 합니다.')}${section('7. 문의처', '서비스 이용 및 약관 관련 문의는 서비스 내 문의 채널 또는 관리자에게 접수할 수 있습니다.')}`,
  }),
};

const PAGES = {
  '/': HOME,
  '/about': ABOUT,
  '/contact': CONTACT,
  '/privacy': PRIVACY,
  '/terms': TERMS,
};

const STATIC_STYLE = `<style data-pagero-seo-style>
[data-pagero-seo-shell]{min-height:100vh;background:#fff;color:#101828;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}[data-pagero-seo-shell] *{box-sizing:border-box}.pagero-seo-wrap{width:min(980px,calc(100% - 40px));margin:0 auto;padding:32px 0 72px}.pagero-seo-wrap>nav{display:flex;flex-wrap:wrap;gap:14px;padding:10px 0 28px;border-bottom:1px solid #e4e7ec}.pagero-seo-wrap a{color:#175cd3;text-decoration:none}.pagero-seo-wrap>nav a{color:#344054;font-size:14px;font-weight:700}.pagero-seo-wrap main{padding-top:48px}.pagero-seo-eyebrow{margin:0 0 10px;color:#175cd3;font-size:13px;font-weight:800}.pagero-seo-wrap h1{margin:0;font-size:clamp(38px,6vw,72px);line-height:1.04;letter-spacing:-.055em}.pagero-seo-intro{max-width:760px;margin:22px 0 42px;color:#475467;font-size:17px;line-height:1.75}.pagero-seo-wrap section{padding:28px 0;border-top:1px solid #eaecf0}.pagero-seo-wrap section h2{margin:0 0 14px;font-size:24px;letter-spacing:-.035em}.pagero-seo-wrap section p,.pagero-seo-wrap li{color:#475467;font-size:15px;line-height:1.75}.pagero-seo-wrap ul{margin:0;padding-left:20px}.pagero-seo-life-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.pagero-seo-life-links a{padding:14px;border:1px solid #e4e7ec;border-radius:14px;background:#f9fafb;color:#101828;font-weight:700}@media(max-width:640px){.pagero-seo-wrap{width:min(100% - 28px,980px);padding-top:18px}.pagero-seo-wrap main{padding-top:34px}.pagero-seo-life-links{grid-template-columns:1fr}.pagero-seo-wrap h1{font-size:40px}}
</style>`;

function replaceTitle(html = '', title = '') {
  const tag = `<title>${escapeHtml(title)}</title>`;
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag);
  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function injectHead(html = '', page, canonical) {
  const tags = [
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="페이지로">',
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
  ].join('\n');
  return html.replace(/<\/head>/i, `${tags}\n${STATIC_STYLE}\n</head>`);
}

function injectBody(html = '', body = '') {
  const emptyRoot = /<div\s+id=["']root["']\s*><\/div>/i;
  if (emptyRoot.test(html)) return html.replace(emptyRoot, `<div id="root">${body}</div>`);
  return html;
}

export async function injectPageroStaticSeo(context, url, response) {
  if (context.request.method !== 'GET') return null;
  if (!isPageroSeoHost(url.hostname)) return null;
  if (!response?.ok) return null;
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) return null;

  const path = cleanPath(url.pathname);
  const page = PAGES[path];
  if (!page) return null;

  const canonical = path === '/' ? `${ROOT_ORIGIN}/` : `${ROOT_ORIGIN}${path}`;
  let html = await response.text();
  html = replaceTitle(html, page.title);
  html = injectHead(html, page, canonical);
  html = injectBody(html, page.body);

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Pagero-Static-SEO', 'raw-html-v1');
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.delete('ETag');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
