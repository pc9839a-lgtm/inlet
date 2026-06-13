import React, { useEffect, useRef, useState } from 'react';

const FEATURES = [
  {
    no: '01',
    title: '구글시트 연동',
    sub: '접수 데이터를 자동으로 저장',
    accent: '#34A853',
    type: 'sheets',
    rows: [['연결 상태', 'connected'], ['신규 접수', '자동 추가'], ['테스트 전송', '성공']],
  },
  {
    no: '02',
    title: '입력폼 임베딩',
    sub: '외부 페이지에도 쉽게 삽입',
    accent: '#E34F26',
    type: 'embed',
    rows: [['임베드 코드', '복사'], ['표시 위치', '외부 페이지'], ['제출 이벤트', '기록']],
  },
  {
    no: '03',
    title: '이메일 알림',
    sub: '접수 즉시 담당자에게 알림',
    accent: '#EA4335',
    type: 'email',
    rows: [['받는 이메일', '설정'], ['새 접수 알림', 'ON'], ['재전송', '가능']],
  },
  {
    no: '04',
    title: '웹훅 전송',
    sub: '외부 도구로 접수 전달',
    accent: '#FF4A00',
    type: 'webhook',
    rows: [['Webhook URL', '입력'], ['전송 테스트', '성공'], ['전달 로그', '저장']],
  },
  {
    no: '05',
    title: '전환 추적',
    sub: '방문, 클릭, 신청 기록',
    accent: '#246FDB',
    type: 'tracking',
    rows: [['CTA 클릭', '기록'], ['UTM', '저장'], ['픽셀 이벤트', '전송']],
  },
  {
    no: '06',
    title: '중복 차단',
    sub: '반복 접수를 기준별로 관리',
    accent: '#F38020',
    type: 'duplicate',
    rows: [['연락처 기준', 'ON'], ['IP 기준', '선택'], ['차단 내역', '확인']],
  },
];

const CREATE_STEPS = [
  ['01', 'URL 먼저 설정', '페이지 주소를 먼저 정하고 시작합니다.'],
  ['02', '화면 구성', 'AI, 템플릿, 직접 편집 중 선택합니다.'],
  ['03', '접수 받기', '입력폼과 버튼으로 고객 정보를 받습니다.'],
  ['04', '관리하기', '접수함과 통계에서 결과를 확인합니다.'],
];

const TEMPLATE_CARDS = [
  ['상담 DB', '광고 유입 고객을 빠르게 접수'],
  ['모바일 청첩장', '초대장과 참석 응답을 한 화면에'],
  ['분양 랜딩', '관심 고객과 방문 예약 관리'],
  ['방문 예약', '일정 선택과 예약 접수'],
  ['견적 문의', '조건 입력 후 상담 연결'],
  ['이벤트 접수', '참가 신청과 알림 관리'],
];

const MARKETING_ITEMS = [
  ['CTA 클릭', 'button', [42, 66, 53, 79, 60, 88, 70]],
  ['UTM 기록', 'campaign', [['naver', '42%'], ['kakao', '31%'], ['direct', '27%']]],
  ['GA4', 'analytics', 'M8 126 C42 46, 70 70, 98 112 S156 164, 188 72 S244 92, 302 34'],
  ['Meta Pixel', 'ads', ['View', 'Click', 'Lead']],
];

function ServiceIcon({ type }) {
  if (type === 'sheets') {
    return (
      <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
        <rect width="96" height="96" rx="26" fill="#fff" />
        <rect x="26" y="18" width="44" height="60" rx="10" fill="#34A853" />
        <path d="M56 18v15h14" fill="#9BE2B0" />
        <path d="M35 41h26M35 52h26M35 63h26M44 35v36M53 35v36" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'embed') {
    return (
      <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
        <rect width="96" height="96" rx="26" fill="#fff" />
        <rect x="20" y="24" width="56" height="48" rx="14" fill="#E34F26" />
        <path d="M41 40L30 48l11 8M55 40l11 8-11 8M51 35l-7 26" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === 'email') {
    return (
      <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
        <rect width="96" height="96" rx="26" fill="#fff" />
        <rect x="19" y="28" width="58" height="42" rx="12" fill="#EA4335" />
        <path d="M25 36l23 18 23-18M25 64l17-14M71 64L54 50" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === 'webhook') {
    return (
      <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
        <rect width="96" height="96" rx="26" fill="#fff" />
        <circle cx="31" cy="32" r="11" fill="#FF4A00" />
        <circle cx="65" cy="48" r="11" fill="#FF4A00" />
        <circle cx="34" cy="66" r="11" fill="#FF4A00" />
        <path d="M41 36l15 7M55 54l-12 7" fill="none" stroke="#0b0d12" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" rx="26" fill="#fff" />
      <path d="M48 18l26 10v19c0 16-10 26-26 32-16-6-26-16-26-32V28l26-10z" fill="#246FDB" />
      <path d="M36 49l8 8 17-20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureGraphic({ type, compact = false }) {
  const className = `feature-graphic is-${type}${compact ? ' is-compact' : ''}`;
  if (type === 'sheets') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-window-bar"><span /><span /><span /><b>auto sync</b></div>
        <div className="graphic-sheet-grid">
          {Array.from({ length: compact ? 16 : 28 }).map((_, index) => <span className={(index + 1) % 5 === 0 ? 'is-filled' : ''} key={index} />)}
        </div>
        <div className="graphic-sync-card"><strong>새 접수</strong><em>시트에 자동 추가</em></div>
      </div>
    );
  }

  if (type === 'embed') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-browser">
          <div className="graphic-code-lines"><span /><span /><span /></div>
          <div className="graphic-form-card"><b>문의 폼</b><i /><i /><strong>삽입 완료</strong></div>
        </div>
        <div className="graphic-embed-badge">&lt;/&gt;</div>
      </div>
    );
  }

  if (type === 'email') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-envelope"><span /></div>
        <div className="graphic-notice-stack"><div><b>새 접수</b><em>메일 발송</em></div><div><b>담당자</b><em>즉시 확인</em></div></div>
      </div>
    );
  }

  if (type === 'webhook') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-flow"><span className="flow-node source">FORM</span><span className="flow-line one" /><span className="flow-node api">API</span><span className="flow-line two" /><span className="flow-node target">CRM</span></div>
        <div className="graphic-payload"><b>POST 200</b><em>delivery success</em></div>
      </div>
    );
  }

  if (type === 'tracking') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-chart-area">
          {[42, 68, 50, 82, 60, 90].map((height, index) => <span className="graphic-mini-bar" style={{ height: `${height}%`, '--bar-delay': `${index * 0.07}s` }} key={height + index} />)}
          <svg className="graphic-line-chart" viewBox="0 0 280 120" preserveAspectRatio="none"><path d="M5 84 C42 38, 70 48, 96 70 S145 96, 172 44 S230 58, 275 24" /></svg>
        </div>
        <div className="graphic-event-chips"><span>view</span><span>click</span><span>lead</span></div>
      </div>
    );
  }

  return (
    <div className={className} aria-hidden="true">
      <div className="graphic-shield"><svg viewBox="0 0 96 96"><path d="M48 12l30 12v22c0 21-12 34-30 42-18-8-30-21-30-42V24l30-12z" /><path d="M35 49l9 9 19-23" /></svg></div>
      <div className="graphic-block-list"><div><b>연락처 기준</b><span>ON</span></div><div><b>IP 기준</b><span>선택</span></div><div><b>차단 내역</b><span>확인</span></div></div>
    </div>
  );
}

function PageroExactHome({ onLogin, onSignup }) {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeMarketing, setActiveMarketing] = useState(0);
  const revealRootRef = useRef(null);
  const active = FEATURES[activeFeature];
  const marketing = MARKETING_ITEMS[activeMarketing];

  useEffect(() => {
    const root = revealRootRef.current;
    if (!root) return undefined;
    const nodes = Array.from(root.querySelectorAll('[data-reveal]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -60px 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveFeature((current) => (current + 1) % FEATURES.length);
      setActiveMarketing((current) => (current + 1) % MARKETING_ITEMS.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pagero-exact-home" ref={revealRootRef}>
      <header className="header">
        <nav className="nav">
          <a href="/" className="logo" aria-label="페이지로"><span className="logo-mark" />PAGERO</a>
          <div className="menu">
            <a href="#features">기능</a>
            <a href="#create">시작</a>
            <a href="#templates">템플릿</a>
            <a href="#leads">접수함</a>
            <a href="#marketing">통계</a>
          </div>
          <button className="header-btn" type="button" onClick={onSignup}>바로 시작하기</button>
        </nav>
      </header>

      <section className="hero">
        <div className="wrap hero-inner">
          <h1 className="hero-title" data-reveal>
            <span>모바일 페이지를</span>
            <span><span className="blue">빠르게</span> 만드세요</span>
          </h1>
          <div className="hero-action" data-reveal style={{ '--delay': '.14s' }}>
            <button className="main-btn" type="button" onClick={onSignup}>바로 시작하기</button>
          </div>
          <div className="hero-preview" data-reveal style={{ '--delay': '.26s' }}>
            <div className="preview-side left">
              <div className="preview-img consult" />
              <div className="preview-line" />
              <div className="preview-line short" />
              <div className="phone-btn">상담 신청</div>
            </div>
            <div className="preview-main">
              <div className="phone-icon" />
              <h2 className="phone-title">모바일 페이지</h2>
              <p className="phone-desc">링크 · 신청 · 접수함</p>
              <div className="phone-btn">신청하기</div>
              <div className="phone-row">이름</div>
              <div className="phone-row">연락처</div>
              <div className="phone-row">문의 내용</div>
            </div>
            <div className="preview-side right">
              <div className="preview-img booking" />
              <div className="preview-line" />
              <div className="preview-line short" />
              <div className="phone-btn">예약하기</div>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-section" id="features">
        <div className="wrap">
          <div className="center" data-reveal><span className="badge">주요 기능</span></div>
          <h2 className="section-title" data-reveal style={{ '--delay': '.1s' }}>연결하고<br />자동으로 받기</h2>
          <div className="feature-layout">
            <div className="feature-sticky-slot">
              <div className="sticky-screen" style={{ '--icon-accent': active.accent }}>
                <div className="screen-top"><div className="screen-dots"><span /><span /><span /></div><div className="screen-status">ON</div></div>
                <div className="screen-sequence" aria-label="기능 순서">
                  {FEATURES.map((item, index) => (
                    <button className={activeFeature === index ? 'is-active' : ''} type="button" onClick={() => setActiveFeature(index)} style={{ '--icon-accent': item.accent }} key={item.title}>
                      <span className="seq-no">{item.no}</span><span>{item.title}</span>
                    </button>
                  ))}
                </div>
                <div className="screen-stage">
                  <div className="screen-feature-icon" style={{ '--icon-accent': active.accent }}><ServiceIcon type={active.type} /></div>
                  <h3 className="screen-title">{active.title}</h3>
                  <div className="screen-sub">{active.sub}</div>
                  <FeatureGraphic type={active.type} />
                  <div className="screen-preview screen-preview--compact">
                    {active.rows.map(([label, value]) => <div className="screen-row" key={label}>{label}<span className="screen-pill">{value}</span></div>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="feature-list">
              {FEATURES.map((item, index) => (
                <article
                  className={`feature-card ${activeFeature === index ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveFeature(index)}
                  onFocus={() => setActiveFeature(index)}
                  data-reveal
                  style={{ '--icon-accent': item.accent, '--delay': `${index * 0.06}s` }}
                  tabIndex={0}
                  key={item.title}
                >
                  <div className="feature-card-head">
                    <div className="feature-title-wrap" style={{ '--icon-accent': item.accent }}>
                      <span className="feature-icon"><ServiceIcon type={item.type} /></span>
                      <h3>{item.title}</h3>
                    </div>
                    <div className="feature-no">{item.no}</div>
                  </div>
                  <FeatureGraphic type={item.type} compact />
                  <div className="ui-box">
                    {item.rows.map(([label, value]) => <div className="ui-row" key={label}>{label}<span className="ui-on">{value}</span></div>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="create">
        <div className="wrap">
          <div className="center" data-reveal><span className="badge">시작</span></div>
          <h2 className="section-title" data-reveal>URL부터 정하고<br />바로 제작합니다</h2>
          <div className="create-grid">
            {CREATE_STEPS.map(([no, title, body]) => <article className="create-card" data-reveal key={no}><span className="create-num">{no}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="template-section section-soft" id="templates">
        <div className="wrap">
          <div className="center" data-reveal><span className="badge">템플릿</span></div>
          <h2 className="section-title" data-reveal>목적에 맞게<br />시작하세요</h2>
          <div className="template-track">
            <div className="template-marquee">
              {[...TEMPLATE_CARDS, ...TEMPLATE_CARDS].map(([title, body], index) => (
                <article className="template-card" key={`${title}-${index}`}>
                  <div className="template-image" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <button className="template-button" type="button" onClick={onSignup}>선택</button>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section split" id="leads">
        <div className="wrap split">
          <h2 className="left-title" data-reveal>접수와 알림을<br />한 곳에서</h2>
          <div className="mock-zone" data-reveal>
            <div className="form-phone">
              <strong className="mock-title">상담 신청</strong>
              <div className="input-box" />
              <div className="input-box" />
              <div className="input-box" />
              <div className="submit-box" />
            </div>
            <div className="inbox-panel">
              <strong className="mock-title">접수함</strong>
              {['김** 상담접수', '박** 방문예약', '이** 문의완료'].map((lead) => <div className="lead-row" key={lead}><span>{lead}</span><b>방금</b></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="section-soft" id="marketing">
        <div className="wrap">
          <div className="center" data-reveal><span className="badge">통계</span></div>
          <h2 className="section-title" data-reveal>어디서 들어왔는지<br />바로 확인합니다</h2>
          <div className="marketing-grid">
            <article className="chart-card" data-reveal>
              <div className="chart-head"><h3>{marketing[0]}</h3><span className="live-dot" /></div>
              {marketing[1] === 'button' && <div className="bars">{marketing[2].map((height, index) => <span className="bar" style={{ height: `${height}%` }} key={index} />)}</div>}
              {marketing[1] === 'campaign' && <div className="marketing-dynamic-panel is-utm">{marketing[2].map(([label, value]) => <div className="utm-row" key={label}><span>{label}</span><i>{value}</i></div>)}</div>}
              {marketing[1] === 'analytics' && <div className="marketing-dynamic-panel is-line"><strong>방문 추이</strong><svg viewBox="0 0 320 170"><path d={marketing[2]} /></svg><b>live</b></div>}
              {marketing[1] === 'ads' && <div className="marketing-dynamic-panel is-pixel">{marketing[2].map((event) => <span key={event}>{event}</span>)}</div>}
            </article>
            <article className="tool-card" data-reveal style={{ '--delay': '.1s' }}>
              <div className="tool-list">
                {MARKETING_ITEMS.map((item, index) => <button className={`tool-item ${activeMarketing === index ? 'is-active' : ''}`} type="button" onClick={() => setActiveMarketing(index)} key={item[0]}><span>{item[0]}</span><b>{item[1]}</b></button>)}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="final-section">
        <div className="wrap center">
          <h2 className="section-title" data-reveal>오늘 받을 접수를<br />오늘 확인하세요</h2>
          <button className="main-btn" type="button" onClick={onSignup}>무료로 시작하기</button>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-inner">
          <strong>페이지로</strong>
          <nav className="footer-links"><a href="/about">사이트소개</a><a href="/contact">문의안내</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a></nav>
        </div>
      </footer>

      <div className="fixed-cta">
        <div className="fixed-inner">
          <div className="fixed-text"><strong>페이지로 시작하기</strong><span>랜딩 제작과 접수 관리를 한 화면에서</span></div>
          <button className="fixed-btn" type="button" onClick={onSignup}>무료 시작</button>
          <button className="fixed-btn" type="button" onClick={onLogin}>로그인</button>
        </div>
      </div>
    </div>
  );
}

export default PageroExactHome;
