(() => {
  const POSTS = [
    {
      category: '\uC790\uB3D9\uCC28',
      title: '\uC790\uB3D9\uCC28\uB4F1\uB85D\uC99D \uC7AC\uBC1C\uAE09 \uC628\uB77C\uC778\u00B7\uBC29\uBB38 \uC2E0\uCCAD \uBC29\uBC95',
      href: '/life/car/car-registration-certificate-reissue/',
    },
    {
      category: '\uC790\uB3D9\uCC28',
      title: '2026 \uC790\uB3D9\uCC28\uC138 \uC5F0\uB0A9 \uC2E0\uCCAD \uC2DC\uAE30\u00B7\uD560\uC778\u00B7\uD658\uAE09 \uD655\uC778',
      href: '/life/car/car-tax-annual-payment-2026/',
    },
    {
      category: '\uC9C0\uC6D0\uC815\uCC45',
      title: '2026 \uADFC\uB85C\u00B7\uC790\uB140\uC7A5\uB824\uAE08 \uAE30\uD55C \uD6C4 \uC2E0\uCCAD \uAE30\uAC04\uACFC \uBC29\uBC95',
      href: '/life/support/earned-income-tax-credit-late-2026/',
    },
    {
      category: '\uC9C0\uC6D0\uC815\uCC45',
      title: '2026 \uB178\uD6C4\uCC28 \uC870\uAE30\uD3D0\uCC28 \uC9C0\uC6D0 \uB300\uC0C1\u00B7\uC2E0\uCCAD \uC21C\uC11C',
      href: '/life/support/early-scrappage-guide/',
    },
  ];

  const ensureLink = (parent, href, label, className = '') => {
    if (!parent || parent.querySelector(`a[href="${href}"]`)) return;
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (className) link.className = className;
    parent.appendChild(link);
  };

  const createLifeSection = () => {
    const section = document.createElement('section');
    section.className = 'c63-life-bridge';
    section.setAttribute('aria-labelledby', 'c63-life-title');

    const inner = document.createElement('div');
    inner.className = 'c63-life-inner';
    const head = document.createElement('div');
    head.className = 'c63-life-head';
    const copy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'c63-life-eyebrow';
    eyebrow.textContent = 'PAGERO LIFE';
    const title = document.createElement('h2');
    title.id = 'c63-life-title';
    title.textContent = '자동차·지원금, 필요한 정보만';
    copy.append(eyebrow, title);

    const more = document.createElement('a');
    more.className = 'c63-life-more';
    more.href = '/life/';
    more.textContent = '\uC0DD\uD65C\uC815\uBCF4 \uC804\uCCB4\uBCF4\uAE30';
    head.append(copy, more);

    const posts = document.createElement('div');
    posts.className = 'c63-life-posts';
    POSTS.forEach((post) => {
      const link = document.createElement('a');
      link.className = 'c63-life-post';
      link.href = post.href;
      const category = document.createElement('span');
      category.textContent = post.category;
      const postTitle = document.createElement('strong');
      postTitle.textContent = post.title;
      const arrow = document.createElement('b');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '\u2192';
      link.append(category, postTitle, arrow);
      posts.appendChild(link);
    });

    inner.append(head, posts);
    section.appendChild(inner);
    return section;
  };

  // Actual public home is the frozen C63 bundle, not src/screens/PageroCanonicalHome.
  // Append this service area through the existing LIFE bridge so it survives C63
  // hydration and uses the same footer insertion point as PAGERO LIFE.
  const createCallTagSection = () => {
    const section = document.createElement('section');
    section.className = 'c63-calltag-bridge';
    section.id = 'c63-calltag';
    section.setAttribute('aria-labelledby', 'c63-calltag-title');

    const inner = document.createElement('div');
    inner.className = 'c63-life-inner';
    const head = document.createElement('div');
    head.className = 'c63-life-head';
    const copy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'c63-life-eyebrow';
    eyebrow.textContent = 'PAGERO · CALLTAG';
    const title = document.createElement('h2');
    title.id = 'c63-calltag-title';
    title.textContent = '문의가 오면, 그다음 관리까지';
    copy.append(eyebrow, title);

    const more = document.createElement('a');
    more.className = 'c63-life-more';
    more.href = 'https://calltag.pagero.kr/';
    more.textContent = '콜태그 알아보기';
    head.append(copy, more);

    const strip = document.createElement('div');
    strip.className = 'c63-calltag-strip';
    const stripMark = document.createElement('span');
    stripMark.className = 'c63-calltag-strip-icon';
    stripMark.setAttribute('aria-hidden', 'true');
    stripMark.textContent = '✓';
    const stripCopy = document.createElement('div');
    stripCopy.className = 'c63-calltag-summary';
    const stripTitle = document.createElement('strong');
    stripTitle.textContent = '전화가 끝나면 태그만 하세요.';
    const stripDetails = document.createElement('p');
    stripDetails.textContent = '통화 직후 상담 이력을 정리하고, 후속 응대를 이어갑니다.';
    stripCopy.append(stripTitle, stripDetails);
    strip.append(stripMark, stripCopy);
        const features = document.createElement('div');
    features.className = 'c63-calltag-features';
    const points = [
      ['신규 고객 알림', '문의 확인'],
      ['통화 메모', '상담 기록'],
      ['안내 문자 자동화', '후속 안내'],
    ];
    for (const [name, explanation] of points) {
      const article = document.createElement('article');
      article.className = 'c63-calltag-feature';
      const heading = document.createElement('h3');
      heading.textContent = name;
      const details = document.createElement('p');
      details.textContent = explanation;
      article.append(heading, details);
      features.appendChild(article);
    }

    inner.append(head, strip, features);
    section.appendChild(inner);
    return section;
  };

  const install = () => {
    const root = document.getElementById('root');
    const home = root?.querySelector('.pagero-exact-home');
    if (!home) return;

    ensureLink(home.querySelector('.header .menu'), '/life/', '\uC0DD\uD65C\uC815\uBCF4', 'c63-life-nav-link');

    const footerLinks = home.querySelector('.footer-links');
    ensureLink(footerLinks, '/about', '\uC0AC\uC774\uD2B8 \uC18C\uAC1C');
    ensureLink(footerLinks, '/contact', '\uBB38\uC758');
    ensureLink(footerLinks, '/privacy', '\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68');
    ensureLink(footerLinks, '/life/', '\uC0DD\uD65C\uBE44\uC11C');
    ensureLink(footerLinks, 'https://awards.pagero.kr/', '\uBE0C\uB79C\uB4DC\uC5B4\uC6CC\uC988');
    ensureLink(footerLinks, 'https://calltag.pagero.kr/', '콜태그');

    const footer = home.querySelector('footer, .footer');
    if (!home.querySelector('.c63-life-bridge')) {
      home.insertBefore(createLifeSection(), footer || null);
    }
    if (!home.querySelector('.c63-calltag-bridge')) {
      home.insertBefore(createCallTagSection(), footer || null);
    }
  };

  let queued = false;
  const queueInstall = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      install();
    });
  };

  const start = () => {
    const root = document.getElementById('root');
    if (!root) return;
    new MutationObserver(queueInstall).observe(root, { childList: true, subtree: true });
    queueInstall();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();