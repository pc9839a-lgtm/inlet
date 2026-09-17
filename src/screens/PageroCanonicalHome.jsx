import { useEffect, useState } from 'react';

const HERO_WORKBENCH_STEPS = [
  { key: 'image', label: '이미지', title: '대표 이미지', desc: '첫 화면을 채웁니다.' },
  { key: 'button', label: '문의 버튼', title: '빠른 문의', desc: '카카오와 전화로 연결합니다.' },
  { key: 'form', label: '신청 폼', title: '상담 신청', desc: '이름과 연락처를 받습니다.' },
  { key: 'map', label: '지도', title: '오시는 길', desc: '방문 위치를 안내합니다.' },
];

const HERO_WIDGETS = [
  ['이미지', '대표 이미지'],
  ['문의', '카카오 · 전화'],
  ['예약', '날짜 · 시간'],
  ['지도', '오시는 길'],
  ['FAQ', '질문 접기'],
  ['타이머', '00:12:48'],
];

const PAGE_CARDS = [
  ['상담 신청', '이름, 연락처, 상담 내용'],
  ['방문 예약', '날짜, 시간, 방문 정보'],
  ['견적 문의', '조건, 예산, 요청사항'],
  ['이벤트 접수', '쿠폰, 체험단, 설명회'],
];

const LIFE_CARDS = [
  ['/life/support/childcare-service-government-support-2026/', '2026 아이돌봄서비스 정부지원', '신청 대상과 지원 기준, 이용 전 확인할 내용을 정리합니다.'],
  ['/life/support/basic-pension-2026/', '2026 기초연금', '대상 기준과 신청 전 확인할 핵심 조건을 공식 자료 기준으로 안내합니다.'],
  ['/life/support/child-allowance-2026/', '2026 아동수당', '지급 대상, 신청 시기와 확인해야 할 행정 절차를 정리합니다.'],
  ['/life/car/car-inspection-period/', '자동차 검사기간 확인', '정기검사·종합검사 시기와 놓치기 쉬운 확인 지점을 안내합니다.'],
  ['/life/car/traffic-fine-check-payment/', '교통 과태료 조회·납부', '조회 경로와 납부 전 확인할 사항을 한 번에 정리합니다.'],
  ['/life/car/car-registration-certificate-reissue/', '자동차등록증 재발급', '온라인·방문 재발급 방법과 준비사항을 정리합니다.'],
];

const LIFE_LINK_STYLE = {
  color: 'inherit',
  textDecoration: 'none',
  display: 'grid',
  gap: 10,
};

const LIFE_LEAD_STYLE = {
  width: 'min(620px, 100%)',
  margin: '14px auto 28px',
  color: '#667085',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 800,
};

const LIFE_ALL_STYLE = {
  marginTop: 24,
  color: '#101828',
  textDecoration: 'none',
  fontSize: 15,
  fontWeight: 950,
};

const SHOWCASE_SAMPLES = [
  {
    tone: 'blue',
    layout: 'consult',
    eyebrow: '상담 랜딩',
    title: '무료 상담을\n바로 신청하세요',
    action: '상담 신청',
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=720&q=80',
    items: ['혜택 안내', '문의 접수', '접수 확인'],
  },
  {
    tone: 'cream',
    layout: 'booking',
    eyebrow: '방문 예약',
    title: '원하는 시간에\n예약을 남겨요',
    action: '예약하기',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=720&q=80',
    items: ['월', '화', '수'],
  },
  {
    tone: 'green',
    layout: 'event',
    eyebrow: '이벤트 접수',
    title: '신청자를\n빠르게 모으세요',
    action: '신청하기',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=720&q=80',
    items: ['D-3', '선착순', '쿠폰'],
  },
  {
    tone: 'dark',
    layout: 'profile',
    eyebrow: '프로필 링크',
    title: '필요한 링크를\n한 곳에 모으세요',
    action: '바로가기',
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=720&q=80',
    items: ['소개', '예약', '문의'],
  },
];

function PageroHeroWorkbench() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_WORKBENCH_STEPS.length);
    }, 1500);

    return () => window.clearInterval(timer);
  }, []);

  const visibleSteps = HERO_WORKBENCH_STEPS.slice(0, activeIndex + 1);

  return (
    <div className="pagerol-workbench" aria-label="블록 편집과 모바일 미리보기">
      <div className="pagerol-editor-card">
        <div className="pagerol-editor-top">
          <span>편집 중</span>
          <b>실시간 반영</b>
        </div>
        <div className="pagerol-editor-list">
          {HERO_WORKBENCH_STEPS.map((step, index) => (
            <div
              className={`pagerol-editor-block ${index <= activeIndex ? 'is-on' : ''} ${index === activeIndex ? 'is-active' : ''}`}
              key={step.key}
            >
              <i>{index + 1}</i>
              <span>
                <strong>{step.label}</strong>
                <em>{step.desc}</em>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pagerol-sync-arrow" aria-hidden="true">→</div>

      <div className="pagerol-preview-phone">
        <div className="pagerol-preview-screen">
          <section className="pagerol-preview-hero">
            <small>모바일 페이지</small>
            <strong>무료 상담 신청</strong>
          </section>
          <div className="pagerol-preview-stack">
            {visibleSteps.map((step) => (
              <article className={`pagerol-preview-block block-${step.key}`} key={step.key}>
                <span>{step.title}</span>
                <b>{step.label}</b>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageroHeroShowcase() {
  return (
    <div className="pagerol-hero-showcase" aria-label="페이지로 모바일 페이지 예시">
      {SHOWCASE_SAMPLES.map((sample, index) => (
        <article className={`pagerol-showcase-card card-${index + 1} tone-${sample.tone} layout-${sample.layout}`} key={sample.eyebrow}>
          <div className="pagerol-showcase-visual" style={{ '--showcase-image': `url(${sample.image})` }}>
            <span>{sample.eyebrow}</span>
            <strong>{sample.title}</strong>
            <button type="button" tabIndex={-1}>{sample.action}</button>
          </div>
          <div className="pagerol-showcase-list">
            {sample.items.map((item) => <i key={item}>{item}</i>)}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function PageroCanonicalHome({ onLogin, onSignup }) {
  return (
    <div className="pagerol-home pagerol-home-v2">
      <header className="pagerol-nav">
        <a href="/" className="pagerol-logo" aria-label="페이지로 홈">페이지로</a>
        <nav aria-label="메인 메뉴">
          <a href="#pages">활용</a>
          <a href="#life">생활정보</a>
        </nav>
        <div className="pagerol-actions">
          <button type="button" onClick={onLogin}>로그인</button>
          <button type="button" onClick={onSignup}>시작하기</button>
        </div>
      </header>

      <main className="pagerol-main">
        <section className="pagerol-hero">
          <div className="pagerol-floating-widgets" aria-hidden="true">
            {HERO_WIDGETS.map(([label, value], index) => (
              <div className={`pagerol-floating-widget widget-${index + 1}`} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="pagerol-hero-copy">
            <p>모바일 랜딩페이지 제작 도구</p>
            <h1>모바일 페이지를<br />빠르게 만드세요</h1>
            <button type="button" className="pagerol-hero-start" onClick={onSignup}>바로 시작하기</button>
          </div>
          <div className="pagerol-hero-demo" aria-label="모바일 페이지 예시">
            <PageroHeroShowcase />
          </div>
        </section>

        <section className="pagerol-workbench-section" aria-label="편집과 미리보기 예시">
          <div className="pagerol-section-title">
            <h2>바로 만들고<br />바로 확인합니다</h2>
          </div>
          <PageroHeroWorkbench />
        </section>

        <section className="pagerol-stats" id="pages">
          <h2>필요한 페이지를<br />바로 만드세요</h2>
          <div className="pagerol-stat-grid">
            {PAGE_CARDS.map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pagerol-stats" id="life" aria-label="생활비서 생활정보">
          <h2>생활에 필요한 정보를<br />한곳에서 확인하세요</h2>
          <p style={LIFE_LEAD_STYLE}>생활비서는 자동차 행정과 정부지원·생활정책을 공식 자료와 확인일을 기준으로 정리하는 페이지로의 생활정보 영역입니다.</p>
          <div className="pagerol-stat-grid">
            {LIFE_CARDS.map(([href, title, body]) => (
              <article key={href}>
                <a href={href} style={LIFE_LINK_STYLE}>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </a>
              </article>
            ))}
          </div>
          <a href="/life/" style={LIFE_ALL_STYLE}>생활비서 전체보기 →</a>
        </section>

        <footer className="pagerol-home-footer" aria-label="페이지로 서비스 정보">
          <div>
            <strong>페이지로</strong>
            <span>노코드 모바일 랜딩페이지 빌더</span>
          </div>
          <nav aria-label="페이지로 하단 메뉴">
            <a href="/life/">생활비서</a>
            <a href="/about">소개</a>
            <a href="/contact">문의</a>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
