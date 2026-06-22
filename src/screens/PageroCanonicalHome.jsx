import { useEffect, useState } from 'react';

const HERO_WORKBENCH_STEPS = [
  { key: 'image', label: '이미지', title: '대표 이미지', desc: '첫 화면을 채웁니다.' },
  { key: 'button', label: '문의 버튼', title: '빠른 문의', desc: '카카오와 전화로 연결합니다.' },
  { key: 'form', label: '신청 폼', title: '상담 신청', desc: '이름과 연락처를 받습니다.' },
  { key: 'map', label: '지도', title: '오시는 길', desc: '방문 위치를 안내합니다.' },
];

const FEATURE_SCREENS = [
  {
    no: '01',
    title: '구글시트 연동',
    sub: '새 접수를 시트에 자동 저장',
    body: '상담 신청이 들어오면 이름, 연락처, 문의 내용이 지정한 시트에 자동으로 쌓입니다.',
    tone: 'green',
    icon: '▦',
    tech: ['Google Sheets', 'OAuth 연결', '자동 행 추가', '테스트 전송'],
    graphic: 'sheet',
  },
  {
    no: '02',
    title: '입력폼 임베드',
    sub: '외부 페이지에도 쉽게 삽입',
    body: '기존 홈페이지나 상세 페이지에 접수폼만 붙여도 같은 접수함으로 모입니다.',
    tone: 'orange',
    icon: '</>',
    tech: ['Embed Script', 'form_id', '외부 삽입', '제출 이벤트'],
    graphic: 'embed',
  },
  {
    no: '03',
    title: '이메일 알림',
    sub: '접수 즉시 담당자에게 알림',
    body: '고객이 신청하는 순간 담당자에게 알림을 보내 빠르게 응대할 수 있게 합니다.',
    tone: 'red',
    icon: '@',
    tech: ['AWS SES', '수신자 설정', '재전송 큐', '발송 로그'],
    graphic: 'mail',
  },
  {
    no: '04',
    title: '웹훅 전송',
    sub: '외부 도구로 접수 전달',
    body: '접수 데이터를 CRM, 자동화 도구, 사내 시스템으로 바로 전달할 수 있습니다.',
    tone: 'coral',
    icon: '⌘',
    tech: ['Webhook URL', 'POST 200', 'Payload', '전송 로그'],
    graphic: 'webhook',
  },
  {
    no: '05',
    title: '전환 추적',
    sub: '방문, 클릭, 신청 기록',
    body: '방문부터 버튼 클릭, 신청 완료까지 고객 행동 흐름을 이벤트로 기록합니다.',
    tone: 'blue',
    icon: '↗',
    tech: ['CTA Click', 'UTM 저장', 'GA4', 'Meta Pixel'],
    graphic: 'tracking',
  },
  {
    no: '06',
    title: '중복 차단',
    sub: '반복 접수 감지',
    body: '연락처, IP, 쿠키 기준으로 반복 접수와 허수 접수를 줄입니다.',
    tone: 'amber',
    icon: '✓',
    tech: ['연락처 기준', 'IP 기준', '쿠키 기준', '차단 이력'],
    graphic: 'block',
  },
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
  {
    tone: 'rose',
    layout: 'invite',
    eyebrow: '초대장',
    title: '소식을 예쁘게\n공유하세요',
    action: '참석 응답',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=720&q=80',
    items: ['날짜', '장소', '메시지'],
  },
];

function PageroFeatureGraphic({ type }) {
  if (type === 'webhook') {
    return (
      <div className="pagerol-feature-graphic graphic-webhook" aria-hidden="true">
        <span>FORM</span>
        <i />
        <span>API</span>
        <i />
        <span>CRM</span>
        <b>POST 200 <em>delivery success</em></b>
      </div>
    );
  }

  if (type === 'sheet') {
    return (
      <div className="pagerol-feature-graphic graphic-sheet" aria-hidden="true">
        <div className="sheet-top"><span /><span /><span /><b>auto sync</b></div>
        <div className="sheet-grid">
          {Array.from({ length: 24 }).map((_, index) => <i className={(index + 2) % 5 === 0 ? 'is-on' : ''} key={index} />)}
        </div>
      </div>
    );
  }

  if (type === 'embed') {
    return (
      <div className="pagerol-feature-graphic graphic-embed" aria-hidden="true">
        <div className="code-panel"><i /><i /><i /></div>
        <div className="form-panel"><b>문의 폼</b><span /><span /><strong>삽입 완료</strong></div>
      </div>
    );
  }

  if (type === 'mail') {
    return (
      <div className="pagerol-feature-graphic graphic-mail" aria-hidden="true">
        <div className="mail-card"><b>새 접수</b><span>담당자 알림</span></div>
        <div className="mail-stack"><i /><i /><i /></div>
      </div>
    );
  }

  if (type === 'tracking') {
    return (
      <div className="pagerol-feature-graphic graphic-tracking" aria-hidden="true">
        {[42, 68, 50, 82, 60, 90].map((height, index) => <i style={{ height: `${height}%` }} key={index} />)}
      </div>
    );
  }

  return (
    <div className="pagerol-feature-graphic graphic-block" aria-hidden="true">
      <div><b>연락처 기준</b><span>ON</span></div>
      <div><b>IP 기준</b><span>선택</span></div>
      <div><b>차단 이력</b><span>확인</span></div>
    </div>
  );
}

function PageroFeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = FEATURE_SCREENS[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % FEATURE_SCREENS.length);
    }, 1900);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="pagerol-feature-section" id="features" aria-label="페이지로 주요 기능">
      <div className="pagerol-section-title">
        <span>주요 기능</span>
        <h2>연결하고<br />자동으로 받기</h2>
      </div>
      <div className="pagerol-feature-showcase">
        <article className={`pagerol-feature-screen tone-${active.tone}`} key={active.no}>
          <div className="feature-browser-bar">
            <i /><i /><i />
            <b>ON</b>
          </div>
          <div className="feature-screen-head">
            <div className="feature-screen-icon">{active.icon}</div>
            <div>
              <em>{active.no} · 주요 기능</em>
              <h3>{active.title}</h3>
              <p>{active.sub}</p>
            </div>
          </div>
          <strong className="feature-screen-body">{active.body}</strong>
          <PageroFeatureGraphic type={active.graphic} />
        </article>

        <div className="pagerol-feature-tech" aria-label="기능 기술 목록">
          {FEATURE_SCREENS.map((item, index) => (
            <button
              className={activeIndex === index ? 'is-active' : ''}
              key={item.title}
              type="button"
              onClick={() => setActiveIndex(index)}
            >
              <strong>{item.title}</strong>
              <span>{item.tech.join(' · ')}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

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
          <a href="#features">기능</a>
          <a href="#pages">활용</a>
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

        <PageroFeatureShowcase />

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

        <footer className="pagerol-home-footer" aria-label="페이지로 서비스 정보">
          <div>
            <strong>페이지로</strong>
            <span>노코드 모바일 랜딩페이지 빌더</span>
          </div>
          <nav aria-label="페이지로 하단 메뉴">
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
