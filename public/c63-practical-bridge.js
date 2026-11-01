/* Compact editorial section, preserving the original PageRo C63 hero and navigation. */
(() => {
  const STEPS = [
    ['01', '폼 구성', '필수 질문을 고릅니다.', '/tools/form-planner/', '구성해 보기'],
    ['02', '페이지 발행', '신청폼을 공개합니다.', '/guide/preview-publish/', '발행 방법'],
    ['03', '접수 확인', '제출 데이터를 검증합니다.', '/guide/inbox-management/', '접수함 보기'],
  ];
  const RESOURCES = [
    ['/guide/contact-form/', '상담 폼'],
    ['/guide/reservation-form/', '방문 예약'],
    ['/guide/troubleshooting/', '오류 해결'],
    ['/guide/analytics/', '전환 통계'],
    ['/tools/lead-calculator/', '광고비 계산'],
    ['/guide/landing-page-prelaunch/', '발행 전 점검'],
  ];
  const element = (tag, className, label) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label) node.textContent = label;
    return node;
  };
  function createGuideSection() {
    const section = element('section', 'c63-guide-bridge');
    section.setAttribute('aria-labelledby', 'c63-guide-title');
    const inner = element('div', 'c63-life-inner');
    const head = element('div', 'c63-life-head');
    const heading = element('div', 'c63-guide-heading');
    heading.appendChild(element('span', 'c63-life-eyebrow', 'PAGERO GUIDE'));
    const title = element('h2', '', '만들고, 받고, 확인하세요.');
    title.id = 'c63-guide-title';
    heading.appendChild(title);
    const mainLink = element('a', 'c63-life-more', '사용 가이드 전체 보기');
    mainLink.href = '/guide/';
    head.append(heading, mainLink);

    const grid = element('div', 'c63-guide-grid');
    for (const [number, label, description, href, actionLabel] of STEPS) {
      const article = element('article', 'c63-guide-card');
      const meta = element('div', 'c63-guide-card-top');
      meta.append(element('span', 'c63-guide-number', number), element('h3', '', label));
      article.append(meta, element('p', '', description));
      const action = element('a', 'c63-guide-action', actionLabel);
      action.href = href;
      article.appendChild(action);
      grid.appendChild(article);
    }

    const resourceLinks = element('nav', 'c63-guide-resources');
    resourceLinks.setAttribute('aria-label', '상세 사용법과 무료 도구');
    for (const [href, label] of RESOURCES) {
      const a = element('a', '', label);
      a.href = href;
      resourceLinks.appendChild(a);
    }
    inner.append(head, grid, resourceLinks);
    section.appendChild(inner);
    return section;
  }
  const install = () => {
    const home = document.querySelector('#root .pagero-exact-home');
    if (!home) return;
    const footer = home.querySelector('footer, .footer');
    if(!home.querySelector('.c63-guide-bridge')){
      home.insertBefore(createGuideSection(),home.querySelector('.c63-life-bridge') || footer || null);
    }
    const links = home.querySelector('.footer-links');
    if (links && !links.querySelector('a[href="/guide/"]')) {
      const a = element('a', '', '사용 가이드');
      a.href = '/guide/';
      links.appendChild(a);
    }
    if (links && !links.querySelector('a[href="/tools/form-planner/"]')) {
      const a = element('a', '', '신청폼 설계 도구');
      a.href = '/tools/form-planner/';
      links.appendChild(a);
    }
  };
  let queued = false;
  const queueInstall = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; install(); });
  };
  const start = () => {
    const root = document.getElementById('root');
    if (!root) return;
    new MutationObserver(queueInstall).observe(root, {childList: true, subtree: true});
    queueInstall();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
})();