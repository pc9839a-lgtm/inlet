export async function onRequest({ request }) {
  const sourceUrl = new URL('/', request.url);
  const sourceResponse = await fetch(sourceUrl.toString(), {
    headers: {
      'Cache-Control': 'no-cache, no-store',
      Pragma: 'no-cache',
    },
  });

  if (!sourceResponse.ok) {
    return new Response('페이지로 메인 미리보기를 불러오지 못했습니다.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  let html = await sourceResponse.text();
  html = html.replace(
    "window.location.replace('/app');",
    "if (location.pathname !== '/landing-preview') window.location.replace('/app');",
  );

  const previewCss = `
<style id="pagero-conversion-preview-style">
  .pagero-exact-home.pagero-conversion-preview {
    display: flex;
    flex-direction: column;
  }
  .pagero-exact-home.pagero-conversion-preview > .header { order: 0; }
  .pagero-exact-home.pagero-conversion-preview > .hero { order: 1; }
  .pagero-exact-home.pagero-conversion-preview > #create { order: 2; }
  .pagero-exact-home.pagero-conversion-preview > #templates { order: 3; }
  .pagero-exact-home.pagero-conversion-preview > #leads { order: 4; }
  .pagero-exact-home.pagero-conversion-preview > #features { order: 5; }
  .pagero-exact-home.pagero-conversion-preview > #marketing { order: 6; }
  .pagero-exact-home.pagero-conversion-preview > .final-section { order: 7; }
  .pagero-exact-home.pagero-conversion-preview > .footer { order: 8; }
  .pagero-exact-home.pagero-conversion-preview > .fixed-cta { order: 9; }
  .pagero-exact-home.pagero-conversion-preview .header .menu a[href="#create"] { order: 1; }
  .pagero-exact-home.pagero-conversion-preview .header .menu a[href="#templates"] { order: 2; }
  .pagero-exact-home.pagero-conversion-preview .header .menu a[href="#leads"] { order: 3; }
  .pagero-exact-home.pagero-conversion-preview .header .menu a[href="#features"] { order: 4; }
  .pagero-exact-home.pagero-conversion-preview .header .menu a[href="#marketing"] { order: 5; }
  .pagero-exact-home .c63-conversion-subcopy {
    width: min(720px, calc(100% - 32px));
    margin: 22px auto 0;
    color: #667085;
    font-size: clamp(16px, 1.8vw, 21px);
    font-weight: 750;
    line-height: 1.6;
    letter-spacing: -.025em;
    text-align: center;
  }
  .pagero-exact-home .c63-conversion-proof {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    width: min(720px, calc(100% - 32px));
    margin: 16px auto 0;
  }
  .pagero-exact-home .c63-conversion-proof span {
    min-height: 34px;
    padding: 0 13px;
    display: inline-flex;
    align-items: center;
    border: 1px solid rgba(15, 23, 42, .09);
    border-radius: 999px;
    background: rgba(255,255,255,.88);
    color: #344054;
    font-size: 12px;
    font-weight: 850;
  }
  @media (max-width: 640px) {
    .pagero-exact-home .c63-conversion-subcopy {
      margin-top: 16px;
      font-size: 15px;
      line-height: 1.55;
    }
    .pagero-exact-home .c63-conversion-proof {
      margin-top: 12px;
      gap: 6px;
    }
    .pagero-exact-home .c63-conversion-proof span {
      min-height: 32px;
      padding: 0 11px;
      font-size: 11px;
    }
  }
</style>`;

  const previewScript = `
<script id="pagero-conversion-preview-script">
(() => {
  const stepCopy = [
    ['페이지 주소 정하기', '공유할 모바일 페이지 주소를 먼저 정합니다.'],
    ['화면 만들기', '템플릿, AI, 직접 편집 중 원하는 방식으로 만듭니다.'],
    ['링크 공유하기', '광고, 문자, SNS에 링크를 바로 공유합니다.'],
    ['접수 확인하기', '신청, 예약, 문의 결과를 접수함과 통계에서 확인합니다.'],
  ];

  const setText = (root, selector, value) => {
    const node = root.querySelector(selector);
    if (node && node.textContent !== value) node.textContent = value;
  };

  const applyPreview = () => {
    const home = document.querySelector('.pagero-exact-home');
    if (!home) return false;
    home.classList.add('pagero-conversion-preview');

    const heroTitle = home.querySelector('.hero-title');
    if (heroTitle && !home.querySelector('.c63-conversion-subcopy')) {
      const subcopy = document.createElement('p');
      subcopy.className = 'c63-conversion-subcopy';
      subcopy.textContent = '랜딩 제작부터 신청·예약 접수, 접수함과 전환 확인까지 한곳에서.';
      heroTitle.insertAdjacentElement('afterend', subcopy);

      const proof = document.createElement('div');
      proof.className = 'c63-conversion-proof';
      ['페이지 제작', '링크 공유', '신청·예약 접수', '접수함·통계 확인'].forEach((label) => {
        const chip = document.createElement('span');
        chip.textContent = label;
        proof.appendChild(chip);
      });
      subcopy.insertAdjacentElement('afterend', proof);
    }

    const heroButton = home.querySelector('.hero-action .main-btn');
    if (heroButton) heroButton.textContent = '무료로 시작하기';
    setText(home, '.preview-main .phone-desc', '제작 · 공유 · 접수 확인');

    const menuLabels = {
      '#create': '시작',
      '#templates': '템플릿',
      '#leads': '접수함',
      '#features': '기능',
      '#marketing': '통계',
    };
    Object.entries(menuLabels).forEach(([href, label]) => {
      const link = home.querySelector('.header .menu a[href="' + href + '"]');
      if (link) link.textContent = label;
    });

    const createTitle = home.querySelector('#create .section-title');
    if (createTitle) createTitle.innerHTML = '4단계면 접수 페이지가<br>완성됩니다';
    home.querySelectorAll('#create .create-card').forEach((card, index) => {
      const copy = stepCopy[index];
      if (!copy) return;
      const title = card.querySelector('h3');
      const body = card.querySelector('p');
      if (title) title.textContent = copy[0];
      if (body) body.textContent = copy[1];
    });

    const templateTitle = home.querySelector('#templates .section-title');
    if (templateTitle) templateTitle.innerHTML = '처음부터 만들 필요 없이<br>목적에 맞게 시작하세요';

    const leadsTitle = home.querySelector('#leads .left-title');
    if (leadsTitle) leadsTitle.innerHTML = '신청이 들어오면<br>바로 확인합니다';

    const featureTitle = home.querySelector('#features .section-title');
    if (featureTitle) featureTitle.innerHTML = '필요한 연결은<br>자동으로 이어집니다';

    const marketingTitle = home.querySelector('#marketing .section-title');
    if (marketingTitle) marketingTitle.innerHTML = '어디서 들어오고<br>무엇을 눌렀는지 확인합니다';

    const finalTitle = home.querySelector('.final-section .section-title');
    if (finalTitle) finalTitle.innerHTML = '페이지를 만들고<br>오늘부터 접수받으세요';
    const finalButton = home.querySelector('.final-section .main-btn');
    if (finalButton) finalButton.textContent = '무료로 시작하기';

    setText(home, '.fixed-cta .fixed-text strong', '모바일 페이지 만들기');
    setText(home, '.fixed-cta .fixed-text span', '만들고 공유하면 접수는 한곳에 모입니다');
    setText(home, '.fixed-cta .fixed-btn:first-of-type', '무료 시작');

    return true;
  };

  let tries = 0;
  const tick = () => {
    if (!applyPreview() && tries++ < 180) requestAnimationFrame(tick);
  };
  tick();

  const root = document.getElementById('root');
  if (root) {
    new MutationObserver(() => applyPreview()).observe(root, { childList: true, subtree: true });
  }
})();
</script>`;

  html = html.replace('</head>', previewCss + '</head>');
  html = html.replace('</body>', previewScript + '</body>');
  html = html.replace(
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta name="robots" content="noindex, nofollow, noarchive" />',
  );

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
