import React, { useEffect, useRef, useState } from 'react';

const legacyFeatureItems = [
  {
    no: '01',
    title: '구글시트 연동',
    sub: '새 접수를 시트에 자동 저장',
    accent: '#34A853',
    type: 'sheets',
    rows: [['연결 상태', 'connected'], ['새 접수', '자동 추가'], ['테스트 전송', '성공']],
  },
  {
    no: '02',
    title: '입력폼 임베드',
    sub: '외부 페이지에도 쉽게 삽입',
    accent: '#E34F26',
    type: 'embed',
    rows: [['임베드 코드', '복사'], ['표시 위치', '외부 페이지'], ['제출 이벤트', '기록']],
  },
  {
    no: '03',
    title: '이메일 알림',
    sub: '접수 즉시 이메일 알림',
    accent: '#EA4335',
    type: 'email',
    rows: [['수신 이메일', '설정'], ['새 접수 알림', 'ON'], ['실패 재전송', '가능']],
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
    accent: '#E37400',
    type: 'tracking',
    rows: [['CTA 클릭', '기록'], ['UTM', '저장'], ['픽셀 이벤트', '전송']],
  },
  {
    no: '06',
    title: '중복 차단',
    sub: '반복 접수 감지',
    accent: '#F38020',
    type: 'duplicate',
    rows: [['연락처 기준', 'ON'], ['IP 기준', '선택'], ['차단 이력', '확인']],
  },
];

const featureItems = [
  {
    no: '01',
    title: '구글시트 연동',
    sub: '새 접수를 시트에 자동 저장',
    accent: '#34A853',
    type: 'sheets',
    rows: [['연결 상태', 'connected'], ['새 접수', '자동 추가'], ['테스트 전송', '성공']],
    tech: ['Google Sheets', 'OAuth 연결', '자동 행 추가', '테스트 전송'],
  },
  {
    no: '02',
    title: '입력폼 임베드',
    sub: '외부 페이지에도 쉽게 삽입',
    accent: '#E34F26',
    type: 'embed',
    rows: [['임베드 코드', '복사'], ['표시 위치', '외부 페이지'], ['제출 이벤트', '기록']],
    tech: ['Embed Script', 'form_id', '외부 삽입', '제출 이벤트'],
  },
  {
    no: '03',
    title: '이메일 알림',
    sub: '접수 즉시 이메일 알림',
    accent: '#EA4335',
    type: 'email',
    rows: [['수신 이메일', '설정'], ['새 접수 알림', 'ON'], ['실패 재전송', '가능']],
    tech: ['AWS SES', '수신자 설정', '재전송 큐', '발송 로그'],
  },
  {
    no: '04',
    title: '웹훅 전송',
    sub: '외부 도구로 접수 전달',
    accent: '#FF4A00',
    type: 'webhook',
    rows: [['Webhook URL', '입력'], ['전송 테스트', '성공'], ['전달 로그', '저장']],
    tech: ['Webhook URL', 'POST 200', 'Payload', '전송 로그'],
  },
  {
    no: '05',
    title: '전환 추적',
    sub: '방문, 클릭, 신청 기록',
    accent: '#E37400',
    type: 'tracking',
    rows: [['CTA 클릭', '기록'], ['UTM', '저장'], ['픽셀 이벤트', '전송']],
    tech: ['CTA Click', 'UTM 저장', 'GA4', 'Meta Pixel'],
  },
  {
    no: '06',
    title: '중복 차단',
    sub: '반복 접수 감지',
    accent: '#F38020',
    type: 'duplicate',
    rows: [['연락처 기준', 'ON'], ['IP 기준', '선택'], ['차단 이력', '확인']],
    tech: ['연락처 기준', 'IP 기준', '쿠키 기준', '차단 이력'],
  },
];

const templates = [
  ['개인회생', '상담 신청형'],
  ['모바일 청첩장', '초대 공유형'],
  ['분양', '관심고객 등록'],
  ['방문 예약', '날짜·시간 접수'],
  ['상담 랜딩', '문의·전화 연결'],
  ['이벤트', '프로모션 접수'],
];

const marketingItems = [
  {
    label: 'CTA 클릭',
    value: 'button',
    title: '전환 이벤트',
    status: 'sample',
    type: 'bar',
    bars: [42, 66, 53, 79, 60, 88, 70],
  },
  {
    label: 'UTM 기록',
    value: 'campaign',
    title: '유입 캠페인',
    status: 'tracked',
    type: 'utm',
    sources: [['naver', '42%'], ['kakao', '31%'], ['direct', '27%']],
  },
  {
    label: 'GA4',
    value: 'analytics',
    title: '방문 분석',
    status: 'live',
    type: 'line',
    points: 'M8 126 C42 46, 70 70, 98 112 S156 164, 188 72 S244 92, 302 34',
  },
  {
    label: 'Meta Pixel',
    value: 'ads',
    title: '광고 이벤트',
    status: 'synced',
    type: 'pixel',
    events: ['View', 'Click', 'Lead'],
  },
  {
    label: 'CSV 저장',
    value: 'export',
    title: '접수 저장',
    status: 'ready',
    type: 'csv',
    rows: [['이름', '연락처', '문의'], ['김**', '010-****', '상담'], ['박**', '010-****', '예약']],
  },
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
  if (type === 'tracking') {
    return (
      <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
        <rect width="96" height="96" rx="26" fill="#fff" />
        <rect x="24" y="24" width="48" height="48" rx="14" fill="#E37400" />
        <rect x="33" y="48" width="8" height="16" rx="4" fill="#fff" />
        <rect x="45" y="35" width="8" height="29" rx="4" fill="#fff" />
        <rect x="57" y="42" width="8" height="22" rx="4" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg className="service-svg" viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" rx="26" fill="#fff" />
      <path d="M48 18l26 10v19c0 16-10 26-26 32-16-6-26-16-26-32V28l26-10z" fill="#F38020" />
      <path d="M36 49l8 8 17-20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureGraphic({ type, compact = false }) {
  const className = `feature-graphic is-${type}${compact ? ' is-compact' : ''}`;

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
        <div className="graphic-notice-stack">
          <div><b>새 접수</b><em>메일 발송</em></div>
          <div><b>담당자</b><em>즉시 확인</em></div>
        </div>
      </div>
    );
  }

  if (type === 'webhook') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-flow">
          <span className="flow-node source">FORM</span>
          <span className="flow-line one" />
          <span className="flow-node api">API</span>
          <span className="flow-line two" />
          <span className="flow-node target">CRM</span>
        </div>
        <div className="graphic-payload"><b>POST 200</b><em>delivery success</em></div>
      </div>
    );
  }

  if (type === 'tracking') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-chart-area">
          {[42, 68, 50, 82, 60, 90].map((height, index) => (
            <span className="graphic-mini-bar" style={{ height: `${height}%`, '--bar-delay': `${index * 0.07}s` }} key={height} />
          ))}
          <svg className="graphic-line-chart" viewBox="0 0 280 120" preserveAspectRatio="none">
            <path d="M5 84 C42 38, 70 48, 96 70 S145 96, 172 44 S230 58, 275 24" />
          </svg>
        </div>
        <div className="graphic-event-chips"><span>view</span><span>click</span><span>lead</span></div>
      </div>
    );
  }

  if (type === 'duplicate') {
    return (
      <div className={className} aria-hidden="true">
        <div className="graphic-shield">
          <svg viewBox="0 0 96 96">
            <path d="M48 12l30 12v22c0 21-12 34-30 42-18-8-30-21-30-42V24l30-12z" />
            <path d="M35 49l9 9 19-23" />
          </svg>
        </div>
        <div className="graphic-block-list">
          <div><b>연락처 기준</b><span>ON</span></div>
          <div><b>IP 기준</b><span>선택</span></div>
          <div><b>차단 이력</b><span>확인</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} aria-hidden="true">
      <div className="graphic-window-bar"><span /><span /><span /><b>auto sync</b></div>
      <div className="graphic-sheet-grid">
        {Array.from({ length: compact ? 16 : 28 }).map((_, index) => (
          <span className={(index + 1) % 5 === 0 ? 'is-filled' : ''} key={index} />
        ))}
      </div>
      <div className="graphic-sync-card"><strong>새 접수</strong><em>시트에 자동 추가</em></div>
    </div>
  );
}

function FeatureSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef(null);
  const cardRefs = useRef([]);
  const manualUntilRef = useRef(0);
  const active = featureItems[activeIndex];
  const activeSummary = {
    '01': '반복 복사 없이 접수 데이터를 정리할 수 있습니다.',
    '02': '이미 운영 중인 페이지도 그대로 활용할 수 있습니다.',
    '03': '접수를 놓치지 않고 응대 속도를 높일 수 있습니다.',
    '04': '상담 준비와 후속 처리를 자동화할 수 있습니다.',
    '05': '광고 성과를 한 흐름으로 확인할 수 있습니다.',
    '06': '불필요한 반복 접수를 줄일 수 있습니다.',
  }[active.no] || '';

  const selectFeature = (index, manual = true) => {
    if (manual) manualUntilRef.current = Date.now() + 3200;
    setActiveIndex(index);
  };

  useEffect(() => {
    const section = sectionRef.current;
    const cards = cardRefs.current.filter(Boolean);
    if (!section || !cards.length) return undefined;

    let ticking = false;
    let lastScrollY = window.scrollY;
    let lastScrollAt = 0;
    const visibleCards = new Map();

    const isInView = () => {
      const rect = section.getBoundingClientRect();
      return rect.bottom > window.innerHeight * 0.12 && rect.top < window.innerHeight * 0.88;
    };

    const updateActiveByCards = () => {
      if (!isInView() || Date.now() < manualUntilRef.current) return;
      const entries = [...visibleCards.values()];
      if (!entries.length) return;
      const best = entries.reduce((result, entry) => (
        entry.intersectionRatio > result.intersectionRatio ? entry : result
      ), entries[0]);
      const nextIndex = Number(best.target.getAttribute('data-feature-index'));
      if (Number.isFinite(nextIndex)) setActiveIndex(nextIndex);
    };

    const updateActiveByGeometry = () => {
      if (!isInView() || Date.now() < manualUntilRef.current) return;
      const anchor = Math.min(window.innerHeight * 0.5, 520);
      const best = cards.reduce((result, card, index) => {
        const rect = card.getBoundingClientRect();
        if (rect.bottom <= 80 || rect.top >= window.innerHeight - 80) return result;
        const distance = Math.abs(rect.top + rect.height * 0.38 - anchor);
        return distance < result.distance ? { distance, index } : result;
      }, { distance: Infinity, index: activeIndex });
      if (Number.isFinite(best.distance)) setActiveIndex(best.index);
    };

    const update = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        lastScrollY = window.scrollY;
        lastScrollAt = Date.now();
        updateActiveByGeometry();
      });
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) update();
    }, { threshold: 0.01, rootMargin: '-8% 0px -8% 0px' });

    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleCards.set(entry.target, entry);
        } else {
          visibleCards.delete(entry.target);
        }
      });
      updateActiveByCards();
    }, { threshold: [0.2, 0.35, 0.5, 0.65], rootMargin: '-24% 0px -24% 0px' });

    sectionObserver.observe(section);
    cards.forEach((card) => cardObserver.observe(card));
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    const timer = window.setInterval(() => {
      updateActiveByGeometry();
    }, 400);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      sectionObserver.disconnect();
      cardObserver.disconnect();
    };
  }, [activeIndex]);

  return (
    <section className="feature-section" id="features" ref={sectionRef}>
      <div className="wrap">
        <div className="center" data-reveal><span className="badge">주요 기능</span></div>
        <h2 className="section-title" data-reveal style={{ '--delay': '.1s' }}>연결하고<br />자동으로 받기</h2>
        <div className="feature-layout">
          <div className="feature-sticky-slot">
            <div
              className="sticky-screen"
              style={{
                '--icon-accent': active.accent,
              }}
            >
              <div className="screen-top">
                <div className="screen-dots"><span /><span /><span /></div>
                <div className="screen-status">ON</div>
              </div>
              <div className="screen-sequence" aria-label="기능 목록">
                {featureItems.map((item, index) => (
                  <button
                    className={index === activeIndex ? 'is-active' : ''}
                    type="button"
                    onClick={() => selectFeature(index)}
                    style={{ '--icon-accent': item.accent }}
                    key={item.no}
                  >
                    <span className="seq-no">{item.no}</span>
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
              <div className="screen-stage screen-stage--title-only">
                <div className="screen-feature-icon" style={{ '--icon-accent': active.accent }}><ServiceIcon type={active.type} /></div>
                <span className="screen-feature-badge">{active.no} · 주요 기능</span>
                <h3 className="screen-title">{active.title}</h3>
                <div className="screen-sub">{active.sub}</div>
                <FeatureGraphic type={active.type} />
                <div className="screen-preview screen-preview--compact">
                  {active.rows.map(([label, value]) => (
                    <div className="screen-row" key={label}>{label}<span className="screen-pill">{value}</span></div>
                  ))}
                </div>
                <div className="screen-summary">{activeSummary}</div>
              </div>
            </div>
          </div>
          <div className="feature-list">
            {featureItems.map((item, index) => (
              <article
                className={`feature-card ${index === activeIndex ? 'is-active' : ''}`}
                ref={(element) => { cardRefs.current[index] = element; }}
                data-feature-index={index}
                onMouseEnter={() => selectFeature(index)}
                onFocus={() => selectFeature(index)}
                tabIndex={0}
                style={{ '--icon-accent': item.accent, '--delay': `${index * 0.06}s` }}
                key={item.no}
              >
                <div className="feature-card-head">
                  <div className="feature-title-wrap" style={{ '--icon-accent': item.accent }}>
                    <span className="feature-icon"><ServiceIcon type={item.type} /></span>
                    <h3>{item.title}</h3>
                  </div>
                  <div className="feature-no">{item.no}</div>
                </div>
                <div className="feature-tech-list" aria-label={`${item.title} 구성`}>
                  {item.tech.map((tech) => (
                    <span className="feature-tech-pill" key={tech}>{tech}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketingPanel({ item }) {
  if (item.type === 'utm') {
    return (
      <div className="marketing-dynamic-panel is-utm">
        {item.sources.map(([label, value]) => (
          <div className="utm-row" key={label}>
            <span>{label}</span>
            <div><i style={{ width: value }} /></div>
            <b>{value}</b>
          </div>
        ))}
      </div>
    );
  }

  if (item.type === 'line') {
    return (
      <div className="marketing-dynamic-panel is-line">
        <strong>PV</strong>
        <b>1,284</b>
        <svg viewBox="0 0 310 150" preserveAspectRatio="none" aria-hidden="true">
          <path d={item.points} />
        </svg>
      </div>
    );
  }

  if (item.type === 'pixel') {
    return (
      <div className="marketing-dynamic-panel is-pixel">
        {item.events.map((event, index) => (
          <span style={{ '--delay': `${index * 0.12}s` }} key={event}>{event}</span>
        ))}
      </div>
    );
  }

  if (item.type === 'csv') {
    return (
      <div className="marketing-dynamic-panel is-csv">
        {item.rows.map((row, index) => (
          <div className={index === 0 ? 'is-head' : ''} key={row.join('-')}>
            {row.map((cell) => <span key={cell}>{cell}</span>)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="marketing-dynamic-panel is-bar">
      <div className="bars">
        {item.bars.map((height, index) => (
          <div className="bar" style={{ height: `${height}%`, '--delay': `${0.05 + index * 0.07}s` }} key={`${height}-${index}`} />
        ))}
      </div>
    </div>
  );
}

function MarketingSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef(null);
  const cardRefs = useRef([]);
  const manualUntilRef = useRef(0);
  const active = marketingItems[activeIndex % marketingItems.length];

  const selectMarketing = (index, manual = true) => {
    if (manual) manualUntilRef.current = Date.now() + 3200;
    setActiveIndex(index);
  };

  useEffect(() => {
    const section = sectionRef.current;
    const cards = cardRefs.current.filter(Boolean);
    if (!section || !cards.length) return undefined;

    let ticking = false;
    let lastScrollY = window.scrollY;
    let lastScrollAt = 0;

    const isInView = () => {
      const rect = section.getBoundingClientRect();
      return rect.bottom > window.innerHeight * 0.12 && rect.top < window.innerHeight * 0.88;
    };

    const updateByScroll = () => {
      if (!isInView() || Date.now() < manualUntilRef.current) return;
      const anchor = window.innerHeight * 0.5;
      const best = cards.reduce((result, card, index) => {
        const rect = card.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return result;
        const distance = Math.abs(rect.top + rect.height / 2 - anchor);
        return distance < result.distance ? { distance, index } : result;
      }, { distance: Infinity, index: 0 });
      if (Number.isFinite(best.distance)) setActiveIndex(best.index);
    };

    const update = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        lastScrollY = window.scrollY;
        lastScrollAt = Date.now();
        updateByScroll();
      });
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) update();
    }, { threshold: 0.01, rootMargin: '-8% 0px -8% 0px' });

    observer.observe(section);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    const timer = window.setInterval(() => {
      const scrollY = window.scrollY;
      if (Math.abs(scrollY - lastScrollY) > 2) {
        lastScrollY = scrollY;
        lastScrollAt = Date.now();
        updateByScroll();
        return;
      }
      if (!isInView() || Date.now() < manualUntilRef.current || Date.now() - lastScrollAt < 1200) return;
      setActiveIndex((current) => (current + 1) % marketingItems.length);
    }, 1600);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  return (
    <section className="section section-soft" id="marketing" ref={sectionRef}>
      <div className="wrap">
        <div className="center" data-reveal><span className="badge">통계</span></div>
        <h2 className="section-title" data-reveal style={{ '--delay': '.1s' }}>방문 · 클릭 · 신청</h2>
        <div className="marketing-showcase marketing-simple-showcase">
          <div className="marketing-event-card" data-reveal style={{ '--tool-accent': '#1677ff' }}>
            <div className="marketing-event-head">
              <h3>{active.title}</h3>
              <div className="live-dot">{active.status}</div>
            </div>
            <MarketingPanel item={active} />
          </div>
          <div className="marketing-slide-list marketing-simple-list">
            {marketingItems.map((item, index) => (
              <button
                className={`marketing-simple-row ${index === activeIndex ? 'is-active' : ''}`}
                type="button"
                ref={(element) => { cardRefs.current[index] = element; }}
                onMouseEnter={() => selectMarketing(index)}
                onFocus={() => selectMarketing(index)}
                style={{ '--tool-accent': '#1677ff', '--delay': `${index * 0.07}s` }}
                key={item.label}
              >
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PageroRestoredHome({ onLogin, onSignup }) {
  const rootRef = useRef(null);
  const handleStart = onSignup || onLogin;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const targets = Array.from(root.querySelectorAll('[data-reveal]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -60px 0px' });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pagero-exact-home" ref={rootRef}>
      <header className="header">
        <nav className="nav">
          <a href="/" className="logo" aria-label="페이지로 홈"><span className="logo-mark" />PAGERO</a>
          <div className="menu">
            <a href="#features">기능</a>
            <a href="#create">시작</a>
            <a href="#templates">템플릿</a>
            <a href="#leads">접수함</a>
            <a href="#marketing">통계</a>
          </div>
          <button className="header-btn" type="button" onClick={handleStart}>바로 시작하기</button>
        </nav>
      </header>

      <section className="hero">
        <div className="wrap hero-inner">
          <h1 className="hero-title" data-reveal>
            <span>모바일 페이지를</span>
            <span><span className="blue">빠르게</span> 만드세요</span>
          </h1>
          <div className="hero-action" data-reveal style={{ '--delay': '.14s' }}>
            <button className="main-btn" type="button" onClick={handleStart}>바로 시작하기</button>
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

      <FeatureSection />

      <section className="section" id="create">
        <div className="wrap">
          <div className="center" data-reveal><span className="badge">시작</span></div>
          <h2 className="section-title" data-reveal style={{ '--delay': '.1s' }}>AI · 템플릿 · 블록</h2>
          <div className="create-grid">
            {['AI 초안', '템플릿 선택', '블록 편집'].map((title, index) => (
              <div className="create-card" data-reveal style={{ '--delay': `${index * 0.1}s` }} key={title}>
                <div className="create-num">{String(index + 1).padStart(2, '0')}</div>
                <h3>{title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section template-section" id="templates">
        <div className="wrap">
          <div className="center" data-reveal><span className="badge">템플릿</span></div>
          <h2 className="section-title" data-reveal style={{ '--delay': '.1s' }}>고르고 수정</h2>
        </div>
        <div className="template-track" data-reveal style={{ '--delay': '.25s' }}>
          <div className="template-marquee">
            {[...templates, ...templates].map(([title, sub], index) => (
              <div className="template-card" key={`${title}-${index}`}>
                <div className="template-image" />
                <h3>{title}</h3>
                <p>{sub}</p>
                <div className="template-line" />
                <div className="template-line" />
                <div className="template-button" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="leads">
        <div className="wrap split">
          <div>
            <span className="badge" data-reveal>접수함</span>
            <h2 className="left-title" data-reveal style={{ '--delay': '.1s' }}>신청받고<br />바로 확인</h2>
          </div>
          <div className="mock-zone" data-reveal style={{ '--delay': '.25s' }}>
            <div className="form-phone">
              <div className="mock-title">신청 폼</div>
              <div className="input-box" />
              <div className="input-box" />
              <div className="input-box" />
              <div className="submit-box" />
            </div>
            <div className="inbox-panel">
              <div className="mock-title">접수함</div>
              {['김도윤', '박민수', '이서연', '최지훈'].map((name, index) => (
                <div className="lead-row" key={name}>{name} <span>{index === 0 ? '신규' : '확인'}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarketingSection />

      <section className="final-section">
        <div className="wrap">
          <h2 className="section-title" data-reveal>모바일 페이지,<br />바로 시작하세요</h2>
          <button className="main-btn" data-reveal style={{ '--delay': '.18s' }} type="button" onClick={handleStart}>바로 시작하기</button>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-inner">
          <div>PAGERO</div>
          <div className="footer-links">
            <a href="/about">서비스 소개</a>
            <a href="/contact">문의</a>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
          </div>
        </div>
      </footer>

      <div className="fixed-cta">
        <div className="fixed-inner">
          <div className="fixed-text">모바일 페이지를 <span>빠르게</span> 만드세요</div>
          <button className="fixed-btn" type="button" onClick={handleStart}>바로 시작하기</button>
        </div>
      </div>
    </div>
  );
}
