import React, { Suspense, useEffect, useRef, useState } from 'react';
import { authAccountErrorMessage, changeAuthPassword, confirmEmailVerification, isValidAccountPassword, loginAuthAccount, normalizeAccountPhone, registerAuthAccount, requestEmailVerification } from '../lib/authAccounts.js';

const demoHero = {
  title: '고객 상담을\n빠르게 연결',
  body: '상담, 예약, 문의 접수를 한 화면에서 받습니다.',
};

const LIVE_DEMO_STEPS = [
  {
    note: '빈 페이지',
    hero: null,
    image: false,
    links: [],
    buttons: [],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'blank',
  },
  {
    note: '히어로 생성',
    hero: demoHero,
    image: false,
    links: [],
    buttons: [],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'hero',
  },
  {
    note: '이미지 추가',
    hero: demoHero,
    image: true,
    links: [],
    buttons: [],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'image',
  },
  {
    note: '카카오 링크',
    hero: demoHero,
    image: true,
    links: [{ type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }],
    buttons: [],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'emoji',
  },
  {
    note: '썸네일 링크',
    hero: demoHero,
    image: true,
    links: [
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
    ],
    buttons: [],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'thumb',
  },
  {
    note: '버튼 추가',
    hero: demoHero,
    image: true,
    links: [
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
    ],
    buttons: ['상담 신청하기', '방문 예약하기'],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'button',
  },
  {
    note: '순서 변경',
    hero: demoHero,
    image: true,
    links: [
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
    ],
    buttons: ['방문 예약하기', '상담 신청하기'],
    timer: false,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'reorder',
  },
  {
    note: '타이머 추가',
    hero: demoHero,
    image: true,
    links: [
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
    ],
    buttons: ['방문 예약하기', '상담 신청하기'],
    timer: true,
    form: false,
    inbox: false,
    saved: false,
    ghost: 'timer',
  },
  {
    note: '상담 폼 연결',
    hero: demoHero,
    image: true,
    links: [
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
    ],
    buttons: ['방문 예약하기', '상담 신청하기'],
    timer: true,
    form: true,
    inbox: false,
    saved: false,
    ghost: 'form',
  },
  {
    note: '문의 저장',
    hero: demoHero,
    image: true,
    links: [
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
    ],
    buttons: ['방문 예약하기', '상담 신청하기'],
    timer: true,
    form: true,
    inbox: true,
    saved: false,
    ghost: 'inbox',
  },
  {
    note: '저장 완료',
    hero: demoHero,
    image: true,
    links: [
      { type: 'thumb', title: '상품 안내', desc: '외부 링크' },
      { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' },
    ],
    buttons: ['방문 예약하기', '상담 신청하기'],
    timer: true,
    form: true,
    inbox: true,
    saved: true,
    ghost: 'save',
  },
];

function BuilderLiveDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const canvasRef = useRef(null);
  const step = LIVE_DEMO_STEPS[stepIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % LIVE_DEMO_STEPS.length);
    }, 1450);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scrollByStep = {
      blank: 0,
      hero: 0,
      image: 0,
      emoji: 56,
      thumb: 112,
      button: 176,
      reorder: 176,
      timer: 238,
      form: 318,
      inbox: 420,
      save: 420,
    };

    window.requestAnimationFrame(() => {
      canvas.scrollTo({
        top: scrollByStep[step.ghost] ?? 0,
        behavior: 'smooth',
      });
    });
  }, [step.ghost]);

  return (
    <div className="live-demo-shell live-screen-loop" aria-label="페이지로 화면 제작 반복 예시">
      <div className="live-phone">
        <div className="live-phone-top">
          <span>페이지로</span>
          <b>LIVE</b>
        </div>

        <div ref={canvasRef} className={`live-canvas ghost-${step.ghost}`}>
          <div className="live-step-badge">{step.note}</div>

          {!step.hero && (
            <div className="live-empty-canvas">
              <i>+</i>
              <span>위젯을 추가하면<br/>화면에 바로 반영됩니다.</span>
            </div>
          )}

          {step.hero && (
            <section key={`hero-${step.hero.title}`} className="live-widget live-hero-widget">
              <small>상담 연결 페이지</small>
              <h2>{step.hero.title}</h2>
              <p>{step.hero.body}</p>
            </section>
          )}

          {step.image && (
            <section className="live-widget live-image-widget">
              <div></div>
              <strong>이미지 위젯</strong>
              <span>대표 이미지 추가</span>
            </section>
          )}

          {!!step.links.length && (
            <section className={`live-widget live-link-widget ${step.ghost === 'reorder' ? 'is-reordering' : ''}`}>
              {step.links.map((link, index) => (
                <div className={`live-link-item ${link.type}`} key={`${link.type}-${link.title}-${index}`}>
                  {link.type === 'emoji' ? (
                    <i>{link.icon}</i>
                  ) : (
                    <i className="thumb"><b></b></i>
                  )}
                  <span>
                    <strong>{link.title}</strong>
                    <em>{link.desc}</em>
                  </span>
                </div>
              ))}
            </section>
          )}

          {!!step.buttons.length && (
            <div className={`live-widget live-button-list ${step.ghost === 'reorder' ? 'is-reordering' : ''}`}>
              {step.buttons.map((label, index) => (
                <button type="button" key={`${label}-${index}`}>{label}</button>
              ))}
            </div>
          )}

          {step.timer && (
            <section className="live-widget live-timer-widget">
              <div>
                <strong>마감까지</strong>
                <span>오늘 신청 혜택</span>
              </div>
              <b>00:10:00</b>
              <i></i>
            </section>
          )}

          {step.form && (
            <section className="live-widget live-form-widget">
              <strong>상담 신청</strong>
              <div><span>이름</span></div>
              <div><span>연락처</span></div>
              <div><span>희망 상담일</span></div>
              <div className="wide"><span>문의 내용</span></div>
              <button type="button">신청 완료</button>
            </section>
          )}

          {step.inbox && (
            <section className="live-widget live-inbox-widget">
              <strong>최근 접수</strong>
              <div><span>김**</span><b>상담신청</b><em>방금</em></div>
              <div><span>이**</span><b>방문예약</b><em>3분 전</em></div>
            </section>
          )}

          {step.saved && <div className="live-save-toast">저장됨</div>}

          <div className="live-cursor">
            {step.ghost === 'reorder' ? '↕' : step.ghost === 'typing' ? '|' : '+'}
          </div>
        </div>
      </div>
    </div>
  );
}

const HOME_NAV_ITEMS = ['기능안내', '사례', '요금', '고객지원'];
const HOME_KEYWORDS = ['랜딩페이지', '상담폼', '예약접수', '고객관리', '전환통계', '외부전송', '모바일페이지', '분양상담', '서비스문의'];
const HOME_FEATURES = [
  ['접수', '상담 신청부터 예약까지 한 화면에'],
  ['관리', '새 문의와 전송 상태를 바로 확인'],
  ['분석', '유입 채널과 클릭 위치를 한눈에'],
  ['연동', '메일 알림과 외부 전송까지 연결'],
];
const HOME_CASES = ['분양 상담', '병원 예약', '법률 문의', '강의 신청', '방문 예약', '이벤트 접수'];

function PageroMarketingHome({ onLogin, onSignup }) {
  return (
    <div className="pagero-home">
      <header className="pagero-home-nav">
        <a className="pagero-home-logo" href="/" aria-label="페이지로 홈">
          <b>페이지로</b>
        </a>
        <nav aria-label="메인 메뉴">
          {HOME_NAV_ITEMS.map((item) => <a href={`#${item}`} key={item}>{item}</a>)}
        </nav>
        <div className="pagero-home-actions">
          <button type="button" onClick={onLogin}>로그인</button>
          <button type="button" className="solid" onClick={onSignup}>무료 시작</button>
        </div>
      </header>

      <main>
        <section className="pagero-hero">
          <div className="pagero-hero-copy">
            <div className="pagero-kicker">
              {['상담', '예약', '문의', '접수'].map((item) => <span key={item}>{item}</span>)}
            </div>
            <h1>고객이 남기는 순간까지<br/>한 페이지로.</h1>
            <p>랜딩페이지를 만들고, 문의를 받고, 어디서 들어왔는지 확인하세요.</p>
            <div className="pagero-hero-cta">
              <button type="button" onClick={onSignup}>지금 만들기</button>
              <button type="button" className="ghost" onClick={onLogin}>내 페이지 열기</button>
            </div>
          </div>

          <div className="pagero-hero-visual" aria-label="페이지로 제작 화면 예시">
            <div className="pagero-phone-card">
              <div className="pagero-phone-top">
                <b>루미에르 리버파크</b>
                <span>LIVE</span>
              </div>
              <div className="pagero-phone-screen">
                <section className="pagero-mock-hero">
                  <span>선착순 상담 마감까지</span>
                  <strong>13 : 42 : 43</strong>
                  <button type="button">잔여 호실 상담</button>
                </section>
                <section className="pagero-mock-feed">
                  <b>실시간 접수현황</b>
                  <div><span>김**님 상담 접수</span><em>방금</em></div>
                  <div><span>이**님 방문예약 접수</span><em>1분 전</em></div>
                  <div><span>박**님 상담 접수</span><em>3분 전</em></div>
                </section>
                <section className="pagero-mock-buttons">
                  <button type="button">분양 관심고객등록</button>
                  <button type="button">예약 모델하우스 방문</button>
                </section>
              </div>
            </div>
            <div className="pagero-floating-panel panel-one">
              <small>오늘 접수</small>
              <strong>128</strong>
              <span>+24%</span>
            </div>
            <div className="pagero-floating-panel panel-two">
              <small>유입 1위</small>
              <strong>네이버</strong>
              <span>42건</span>
            </div>
          </div>
        </section>

        <section className="pagero-marquee" aria-label="제작 가능 페이지">
          <div>
            {[...HOME_KEYWORDS, ...HOME_KEYWORDS].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          </div>
        </section>

        <section className="pagero-stats" id="기능안내">
          <div>
            <span>만들고</span>
            <strong>5분</strong>
          </div>
          <div>
            <span>받고</span>
            <strong>24시간</strong>
          </div>
          <div>
            <span>확인하고</span>
            <strong>한눈에</strong>
          </div>
        </section>

        <section className="pagero-section pagero-feature-grid">
          <div className="pagero-section-head">
            <h2>페이지가 아니라<br/>접수 흐름을 만듭니다</h2>
            <p>광고를 눌러 들어온 고객이 바로 남길 수 있게.</p>
          </div>
          <div className="pagero-feature-cards">
            {HOME_FEATURES.map(([title, body]) => (
              <article key={title}>
                <span>{title}</span>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pagero-section pagero-case-section" id="사례">
          <div className="pagero-section-head">
            <h2>업종마다 필요한 화면만</h2>
            <p>템플릿은 가볍게, 운영은 바로.</p>
          </div>
          <div className="pagero-case-loop">
            {HOME_CASES.map((item, index) => (
              <article key={item}>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <strong>{item}</strong>
                <span>폼 · 버튼 · 알림</span>
              </article>
            ))}
          </div>
        </section>

        <section className="pagero-final" id="요금">
          <h2>오늘 받은 문의를<br/>오늘 확인하세요</h2>
          <button type="button" onClick={onSignup}>무료로 시작하기</button>
        </section>
      </main>
    </div>
  );
}

function PublicHome({ onLogin, onSignup }) {
  return <PageroLittlyHome onLogin={onLogin} onSignup={onSignup} />;

  return (
    <div className="public-home-shell">
      <header className="public-home-header">
        <div className="public-home-brand">
          <strong>페이지로</strong>
          <span>페이지로</span>
        </div>

        <nav>
          <button type="button" onClick={onLogin}>로그인</button>
          <button type="button" className="primary" onClick={onSignup}>무료 시작</button>
        </nav>
      </header>

      <main className="public-home-main">
        <section className="public-hero public-hero-single">
          <div className="public-hero-copy">
            <span>페이지로 · Form · Inbox</span>
            <h1>고객이 들어오는<br/>첫 화면을 만드세요.</h1>
            <p>AI 초안으로 시작하고, 문구·버튼·상담폼은 직접 쉽게 수정하세요.</p>

            <div className="public-hero-actions">
              <button type="button" onClick={onSignup}>무료로 시작하기</button>
              <button type="button" className="ghost" onClick={onLogin}>로그인</button>
            </div>
          </div>

          <BuilderLiveDemo/>
        </section>
      </main>
    </div>
  );
}

const PAGEROL_HOME_NAV = ['기능안내', '사례', '요금', '고객지원'];
const PAGEROL_HERO_WORDS = ['광고', '분양', '상담', '예약', '문의', '방문', '접수', '관리', '통계', '알림', '전송', '페이지'];
const PAGEROL_MOTION_ROWS = [
  ['광고', '분양', '상담', '예약', '문의', '방문', '접수', '관리'],
  ['랜딩페이지', '상담폼', '예약폼', '접수함', '전환통계', '메일알림'],
  ['네이버', '카카오', '인스타그램', '구글', '직접 유입', '외부 링크'],
];
const PAGEROL_FLOW = [
  ['01', '페이지 만들기', '상호명과 목적만 넣고 시작'],
  ['02', '폼 연결하기', '이름, 연락처, 관심 항목을 받기'],
  ['03', '접수 확인하기', '문의와 전송 상태를 한곳에서'],
  ['04', '유입 보기', '채널, 기기, 클릭 위치까지'],
];
const PAGEROL_FEATURES = [
  ['상담폼', '필요한 질문만 골라 받기'],
  ['예약폼', '방문 시간과 희망 일자 받기'],
  ['접수함', '새 문의, 중복, 전송 상태 관리'],
  ['통계', '유입 채널과 전환 흐름 확인'],
  ['메일 알림', '접수 즉시 담당자에게 전달'],
  ['외부 전송', '웹훅과 시트로 데이터 연결'],
  ['멀티 페이지', '브랜드와 현장별로 따로 운영'],
  ['HTML 임베드', '외부 사이트에도 폼만 붙이기'],
];
const PAGEROL_USE_CASES = ['분양 상담', '병원 예약', '법률 상담', '강의 신청', '방문 예약', '이벤트 접수', '가맹 문의', '서비스 견적', '채용 문의'];
const PAGEROL_FAQS = [
  ['코딩 없이 만들 수 있나요?', '네. 블록을 고르고 문구만 바꾸면 바로 공개할 수 있습니다.'],
  ['접수 데이터는 어디서 보나요?', '페이지로 접수함에서 신규 문의, 중복 여부, 알림 전송 상태를 확인합니다.'],
  ['외부 사이트에도 붙일 수 있나요?', '폼 HTML 코드를 복사해 기존 홈페이지나 블로그에 붙일 수 있습니다.'],
  ['여러 페이지를 운영할 수 있나요?', '현장, 브랜드, 캠페인별로 페이지를 나눠 운영할 수 있습니다.'],
];
const PAGEROL_BUILD_STEPS = [
  { note: '빈 화면', ghost: 'blank' },
  { note: '히어로 추가', ghost: 'hero', hero: true },
  { note: '이미지 추가', ghost: 'image', hero: true, image: true },
  { note: '카카오 연결', ghost: 'emoji', hero: true, image: true, links: [{ type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }] },
  { note: '링크 추가', ghost: 'thumb', hero: true, image: true, links: [{ type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }, { type: 'thumb', title: '분양 안내', desc: '외부 링크' }] },
  { note: '버튼 추가', ghost: 'button', hero: true, image: true, links: [{ type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }, { type: 'thumb', title: '분양 안내', desc: '외부 링크' }], buttons: ['상담 신청하기', '방문 예약하기'] },
  { note: '순서 변경', ghost: 'reorder', hero: true, image: true, links: [{ type: 'thumb', title: '분양 안내', desc: '외부 링크' }, { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }], buttons: ['방문 예약하기', '상담 신청하기'] },
  { note: '타이머 추가', ghost: 'timer', hero: true, image: true, links: [{ type: 'thumb', title: '분양 안내', desc: '외부 링크' }, { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }], buttons: ['방문 예약하기', '상담 신청하기'], timer: true },
  { note: '폼 연결', ghost: 'form', hero: true, image: true, links: [{ type: 'thumb', title: '분양 안내', desc: '외부 링크' }, { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }], buttons: ['방문 예약하기', '상담 신청하기'], timer: true, form: true },
  { note: '접수 저장', ghost: 'inbox', hero: true, image: true, links: [{ type: 'thumb', title: '분양 안내', desc: '외부 링크' }, { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }], buttons: ['방문 예약하기', '상담 신청하기'], timer: true, form: true, inbox: true },
  { note: '저장 완료', ghost: 'save', hero: true, image: true, links: [{ type: 'thumb', title: '분양 안내', desc: '외부 링크' }, { type: 'emoji', icon: '💬', title: '카카오 상담', desc: '바로 연결' }], buttons: ['방문 예약하기', '상담 신청하기'], timer: true, form: true, inbox: true, saved: true },
];

function PageroBuildDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const canvasRef = useRef(null);
  const step = PAGEROL_BUILD_STEPS[stepIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % PAGEROL_BUILD_STEPS.length);
    }, 1350);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scrollByStep = {
      blank: 0,
      hero: 0,
      image: 0,
      emoji: 56,
      thumb: 112,
      button: 176,
      reorder: 176,
      timer: 238,
      form: 318,
      inbox: 420,
      save: 420,
    };
    window.requestAnimationFrame(() => {
      canvas.scrollTo({ top: scrollByStep[step.ghost] ?? 0, behavior: 'smooth' });
    });
  }, [step.ghost]);

  return (
    <div className="live-demo-shell live-screen-loop pagerol-build-demo" aria-label="페이지로 화면 제작 반복 예시">
      <div className="live-phone">
        <div className="live-phone-top">
          <span>페이지로</span>
          <b>LIVE</b>
        </div>
        <div ref={canvasRef} className={`live-canvas ghost-${step.ghost}`}>
          <div className="live-step-badge">{step.note}</div>

          {!step.hero && (
            <div className="live-empty-canvas">
              <i>+</i>
              <span>위젯을 추가하면<br/>화면이 바로 채워집니다</span>
            </div>
          )}

          {step.hero && (
            <section className="live-widget live-hero-widget">
              <small>상담 연결 페이지</small>
              <h2>고객 상담을{'\n'}빠르게 연결</h2>
              <p>상담, 예약, 문의 접수를 한 화면에서 받습니다.</p>
            </section>
          )}

          {step.image && (
            <section className="live-widget live-image-widget">
              <div></div>
              <strong>대표 이미지</strong>
              <span>현장 이미지 추가</span>
            </section>
          )}

          {!!step.links?.length && (
            <section className={`live-widget live-link-widget ${step.ghost === 'reorder' ? 'is-reordering' : ''}`}>
              {step.links.map((link, index) => (
                <div className={`live-link-item ${link.type}`} key={`${link.type}-${link.title}-${index}`}>
                  {link.type === 'emoji' ? <i>{link.icon}</i> : <i className="thumb"><b></b></i>}
                  <span>
                    <strong>{link.title}</strong>
                    <em>{link.desc}</em>
                  </span>
                </div>
              ))}
            </section>
          )}

          {!!step.buttons?.length && (
            <div className={`live-widget live-button-list ${step.ghost === 'reorder' ? 'is-reordering' : ''}`}>
              {step.buttons.map((label, index) => <button type="button" key={`${label}-${index}`}>{label}</button>)}
            </div>
          )}

          {step.timer && (
            <section className="live-widget live-timer-widget">
              <div>
                <strong>마감까지</strong>
                <span>오늘 신청 혜택</span>
              </div>
              <b>00:10:00</b>
              <i></i>
            </section>
          )}

          {step.form && (
            <section className="live-widget live-form-widget">
              <strong>상담 신청</strong>
              <div><span>이름</span></div>
              <div><span>연락처</span></div>
              <div><span>희망 상담</span></div>
              <div className="wide"><span>문의 내용</span></div>
              <button type="button">신청 완료</button>
            </section>
          )}

          {step.inbox && (
            <section className="live-widget live-inbox-widget">
              <strong>최근 접수</strong>
              <div><span>김**</span><b>상담신청</b><em>방금</em></div>
              <div><span>이**</span><b>방문예약</b><em>3분 전</em></div>
            </section>
          )}

          {step.saved && <div className="live-save-toast">저장됨</div>}
          <div className="live-cursor">{step.ghost === 'reorder' ? '↕' : '+'}</div>
        </div>
      </div>
    </div>
  );
}

function PageroLittlyHome({ onLogin, onSignup }) {
  return (
    <div className="pagerol-home">
      <header className="pagerol-nav">
        <a href="/" className="pagerol-logo" aria-label="페이지로 홈">페이지로</a>
        <nav aria-label="메인 메뉴">
          {PAGEROL_HOME_NAV.map((item) => <a href={`#${item}`} key={item}>{item}</a>)}
        </nav>
        <div className="pagerol-actions">
          <button type="button" onClick={onLogin}>로그인</button>
          <button type="button" onClick={onSignup}>무료 시작</button>
        </div>
      </header>

      <main>
        <section className="pagerol-hero">
          <div className="pagerol-motion-lanes" aria-hidden="true">
            {PAGEROL_MOTION_ROWS.map((row, rowIndex) => (
              <div className={`pagerol-motion-row row-${rowIndex + 1}`} key={`row-${rowIndex}`}>
                {[...row, ...row, ...row].map((word, index) => (
                  <span key={`${word}-${rowIndex}-${index}`}>{word}</span>
                ))}
              </div>
            ))}
          </div>
          <div className="pagerol-hero-copy">
            <p>상담 · 예약 · 문의 · 접수</p>
            <h1>고객이 남기는<br/>첫 화면</h1>
            <button type="button" onClick={onSignup}>무료로 시작하기</button>
          </div>
          <div className="pagerol-phone-stage">
            <PageroBuildDemo />
            <div className="pagerol-chip chip-a"><span>오늘 접수</span><b>128</b></div>
            <div className="pagerol-chip chip-b"><span>전송 상태</span><b>정상</b></div>
            <div className="pagerol-chip chip-c"><span>유입 1위</span><b>네이버</b></div>
          </div>
        </section>

        <section className="pagerol-stats" id="기능안내">
          <h2>페이지로는<br/>간단해야 합니다</h2>
          <div className="pagerol-stat-grid">
            <article><span>제작 시간</span><strong>5분</strong><p>문구와 폼만 바꾸면 바로 공개</p></article>
            <article><span>접수 방식</span><strong>24시간</strong><p>광고가 켜진 동안 계속 수집</p></article>
            <article><span>확인 위치</span><strong>한곳</strong><p>문의, 전송, 통계까지 한 화면</p></article>
            <article><span>시작 비용</span><strong>0원</strong><p>먼저 만들고 운영 흐름 확인</p></article>
          </div>
        </section>

        <section className="pagerol-build">
          <div className="pagerol-section-title">
            <h2>코딩 없이<br/>접수까지 연결</h2>
            <p>만들고 끝나는 페이지가 아니라, 고객이 남기는 흐름까지 이어집니다.</p>
          </div>
          <div className="pagerol-flow">
            {PAGEROL_FLOW.map(([num, title, body]) => (
              <article key={title}>
                <small>{num}</small>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="pagerol-features">
          <div className="pagerol-section-title compact">
            <h2>페이지로 할 수 있는 것</h2>
            <p>필요한 기능만 꺼내 쓰세요.</p>
          </div>
          <div className="pagerol-feature-grid">
            {PAGEROL_FEATURES.map(([title, body]) => (
              <article key={title}>
                <b>{title}</b>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="pagerol-marquee" id="사례" aria-label="활용 사례">
          <div>
            {[...PAGEROL_USE_CASES, ...PAGEROL_USE_CASES].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          </div>
        </section>

        <section className="pagerol-cases">
          <div className="pagerol-section-title">
            <h2>현장마다<br/>남기는 방식이 다르니까</h2>
            <p>분양, 병원, 법률, 강의, 예약 문의까지 화면을 나눠 운영합니다.</p>
          </div>
          <div className="pagerol-case-grid">
            <article><small>분양 상담</small><strong>관심 타입과 예산대를 받고 바로 연락</strong><span>상담폼 · 타이머 · 접수현황</span></article>
            <article><small>방문 예약</small><strong>희망 날짜와 시간을 받아 예약 흐름 정리</strong><span>예약폼 · 알림 · 접수함</span></article>
            <article><small>서비스 문의</small><strong>견적에 필요한 질문만 받아 누락 줄이기</strong><span>질문폼 · 파일링크 · 통계</span></article>
          </div>
        </section>

        <section className="pagerol-review">
          <div className="pagerol-review-card">
            <span>운영자 화면</span>
            <h2>문의가 들어오면<br/>바로 보입니다</h2>
            <p>이름, 연락처, 관심 항목, 유입 채널, 알림 전송 상태까지 접수함에서 확인합니다.</p>
          </div>
          <div className="pagerol-dashboard">
            <div><span>신규 접수</span><b>32</b></div>
            <div><span>CTA 클릭</span><b>87</b></div>
            <div><span>메일 전송</span><b>정상</b></div>
            <div><span>상위 채널</span><b>네이버</b></div>
          </div>
        </section>

        <section className="pagerol-faq" id="고객지원">
          <h2>자주 묻는 질문</h2>
          <div>
            {PAGEROL_FAQS.map(([q, a]) => (
              <article key={q}>
                <strong>{q}</strong>
                <p>{a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pagerol-final" id="요금">
          <h2>지금 필요한 건<br/>예쁜 소개보다 빠른 접수</h2>
          <button type="button" onClick={onSignup}>페이지 만들기</button>
        </section>
      </main>
    </div>
  );
}

function AuthScreen({ onAuth, initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', password2: '', verificationCode: '' });
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => {
    setError('');
    setNotice('');
    if (key === 'email') setEmailVerified(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const verifyEmail = async () => {
    const email = form.email.trim().toLowerCase();
    setError('');
    setNotice('');
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (form.verificationCode.trim()) {
        await confirmEmailVerification({ email, token: form.verificationCode.trim() });
        setEmailVerified(true);
        setNotice('이메일 인증이 완료되었습니다.');
        return;
      }
      const verification = await requestEmailVerification(email, mode === 'reset' ? 'password-reset' : 'signup');
      const token = String(verification?.token || '').trim();
      if (!token) {
        setNotice('인증 메일을 보냈습니다. 이메일로 받은 인증 코드를 입력한 뒤 다시 인증해주세요.');
        return;
      }
      await confirmEmailVerification({ email, token });
      setEmailVerified(true);
      setNotice('이메일 인증이 완료되었습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const phone = normalizeAccountPhone(form.phone);

    if (!email || !form.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (mode === 'reset') {
      if (!emailVerified) {
        setError('이메일 인증을 완료해야 비밀번호를 바꿀 수 있습니다.');
        return;
      }
      if (!isValidAccountPassword(form.password)) {
        setError('비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.');
        return;
      }
      if (form.password !== form.password2) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
      setSaving(true);
      try {
        await changeAuthPassword({ email, password: form.password, token: form.verificationCode.trim() });
        setForm((prev) => ({ ...prev, password: '', password2: '', verificationCode: '' }));
        setEmailVerified(false);
        setMode('login');
        setNotice('비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.');
      } catch (err) {
        setError(authAccountErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!form.name.trim()) {
        setError('이름을 입력해주세요.');
        return;
      }

      if (!phone) {
        setError('핸드폰번호를 입력해주세요.');
        return;
      }

      if (!isValidAccountPassword(form.password)) {
        setError('비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.');
        return;
      }

      if (form.password !== form.password2) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }

      if (!emailVerified) {
        setError('이메일 인증을 먼저 완료해주세요.');
        return;
      }
    }

    setSaving(true);
    try {
      const authUser = mode === 'signup'
        ? await registerAuthAccount({
          name: form.name.trim(),
          email,
          phone,
          password: form.password,
          token: form.verificationCode.trim(),
          source: 'signup',
        })
        : await loginAuthAccount({ email, password: form.password });
      onAuth({
        ...(authUser || {}),
        name: authUser?.name || (mode === 'signup' ? form.name.trim() : (form.name.trim() || '사용자')),
        email,
        phone: authUser?.phone || phone,
        signedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        {onBack && <button className="auth-back" type="button" onClick={onBack}>← 메인으로</button>}
        <div className="auth-brand">
          <strong>페이지로</strong>
          <span>고객 인입 랜딩 빌더</span>
        </div>

        <div className="auth-copy">
          <h1>{mode === 'login' ? '로그인' : '페이지로 시작하기'}</h1>
          <p>고객이 들어오는 첫 화면을 만들고 관리하세요.</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <label>
              <span>이름</span>
              <input value={form.name} onChange={(e)=>set('name', e.target.value)} placeholder="이름" />
            </label>
          )}

          {mode === 'signup' && (
            <label>
              <span>핸드폰번호</span>
              <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e)=>set('phone', e.target.value)} placeholder="01012345678" />
            </label>
          )}

          <label>
            <span>이메일</span>
            <input type="text" inputMode="email" autoComplete="email" value={form.email} onChange={(e)=>set('email', e.target.value)} placeholder="email@example.com" />
          </label>

          <label>
            <span>비밀번호</span>
            <input type="password" value={form.password} onChange={(e)=>set('password', e.target.value)} placeholder="비밀번호" />
          </label>

          {(mode === 'signup' || mode === 'reset') && (
            <label>
              <span>비밀번호 확인</span>
              <input type="password" value={form.password2} onChange={(e)=>set('password2', e.target.value)} placeholder="비밀번호 확인" />
            </label>
          )}

          {(mode === 'signup' || mode === 'reset') && (
            <>
              {!emailVerified && (
                <label>
                  <span>이메일 인증 코드</span>
                  <input value={form.verificationCode} onChange={(e)=>set('verificationCode', e.target.value)} placeholder="인증 코드" />
                </label>
              )}
              <button className="ghost-btn" type="button" onClick={verifyEmail} disabled={emailVerified || saving}>
                {emailVerified ? '이메일 인증 완료' : form.verificationCode ? '인증 코드 확인' : '인증 메일 보내기'}
              </button>
            </>
          )}

          {notice && <p className="auth-notice">{notice}</p>}
          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={saving}>{saving ? '처리 중' : mode === 'login' ? '로그인' : mode === 'reset' ? '비밀번호 변경' : '회원가입'}</button>
        </form>

        <button className="auth-switch" type="button" onClick={()=>{ setError(''); setNotice(''); setEmailVerified(false); setMode(mode === 'login' ? 'signup' : 'login'); }}>
          {mode === 'login' ? '아직 계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
        {mode === 'login' && (
          <button className="auth-switch" type="button" onClick={()=>{ setError(''); setNotice(''); setEmailVerified(false); setMode('reset'); }}>
            이메일 인증 후 비밀번호 변경
          </button>
        )}
      </section>
    </div>
  );
}

function TemplatePanelSlot({ Component, page, templates, onApply }) {
  if (!Component) return null;
  return (
    <Suspense fallback={<div className="template-panel-loading" />}>
      <Component page={page} templates={templates} onApply={onApply} />
    </Suspense>
  );
}

function Dashboard({ user, page, leads, onCreate, onEdit, onPreview, onLogout, onAccountUpdate, onAi, onManual, onTemplate, templates = [], TemplatesPanelComponent = null }) {
  const hasPage = !!page?.title;
  const leadCount = Array.isArray(leads) ? leads.length : 0;
  const [createOpen, setCreateOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountDraft, setAccountDraft] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const openCreate = () => setCreateOpen(true);
  const accountName = user?.name || user?.email || '사용자';
  const accountMode = user?.accessMode || user?.role || 'master';
  const modeLabel = accountMode === 'manager' ? '매니저' : accountMode === 'clientAdmin' ? '클라이언트 관리자' : '마스터';
  const aiStatus = page?.ai?.lastTestStatus || 'idle';
  const aiCostLabel = aiStatus === 'success' || aiStatus === 'saved' ? '고객 키 확인됨' : '요청 시 고객 키';
  const setAccountField = (key, value) => {
    setAccountError('');
    setAccountDraft((current) => ({ ...current, [key]: value }));
  };
  const saveAccount = async (event) => {
    event.preventDefault();
    if (!onAccountUpdate) return;
    setAccountSaving(true);
    setAccountError('');
    try {
      await onAccountUpdate(accountDraft);
      setAccountOpen(false);
    } catch (err) {
      setAccountError(authAccountErrorMessage(err));
    } finally {
      setAccountSaving(false);
    }
  };

  useEffect(() => {
    setAccountDraft({ name: user?.name || '', phone: user?.phone || '' });
  }, [user?.name, user?.phone]);

  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="home-brand">
          <strong>페이지로</strong>
          <span>랜딩 관리</span>
        </div>

        <div className="home-user home-account-card">
          <div className="home-account-avatar" aria-hidden="true">{String(accountName).slice(0, 1).toUpperCase()}</div>
          <div className="home-account-meta">
            <strong>{accountName}</strong>
            <span>{user?.email || '이메일 없음'}</span>
          </div>
          <em>{modeLabel}</em>
          <button type="button" onClick={() => setAccountOpen((open) => !open)}>{accountOpen ? '닫기' : '계정'}</button>
          <button type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero home-dashboard-hero">
          <div>
            <span>고객 접수 랜딩 빌더</span>
            <h1>랜딩페이지를 만들고<br/>접수와 통계를 관리하세요.</h1>
            <p>페이지 제작, 접수함, 통계, 설정을 한 화면에서 관리합니다.</p>
          </div>

          <button type="button" onClick={openCreate}>새 랜딩 만들기</button>
        </section>

        <section className="home-account-summary" aria-label="계정 상태">
          <div>
            <span>계정</span>
            <strong>{user?.email || '이메일 없음'}</strong>
          </div>
          <div>
            <span>휴대폰</span>
            <strong>{user?.phone || '미등록'}</strong>
          </div>
          <div>
            <span>권한</span>
            <strong>{modeLabel}</strong>
          </div>
          <div>
            <span>AI 비용</span>
            <strong>{aiCostLabel}</strong>
          </div>
        </section>

        {accountOpen && (
          <section className="home-section home-account-edit">
            <div className="home-section-title">
              <h2>계정 설정</h2>
              <button type="button" onClick={() => setAccountOpen(false)}>닫기</button>
            </div>
            <form className="home-account-form" onSubmit={saveAccount}>
              <label>
                <span>이름</span>
                <input value={accountDraft.name} onChange={(event) => setAccountField('name', event.target.value)} placeholder="이름" />
              </label>
              <label>
                <span>이메일</span>
                <input value={user?.email || ''} disabled placeholder="email@example.com" />
              </label>
              <label>
                <span>휴대폰</span>
                <input type="tel" inputMode="tel" value={accountDraft.phone} onChange={(event) => setAccountField('phone', event.target.value)} placeholder="01012345678" />
              </label>
              <p>비밀번호 변경은 로그인 화면의 이메일 인증 후 비밀번호 변경 흐름을 사용합니다. AI API 키는 기본적으로 저장하지 않고 생성 요청 시 고객 키를 사용합니다.</p>
              {accountError && <strong className="auth-error">{accountError}</strong>}
              <button type="submit" disabled={accountSaving}>{accountSaving ? '저장 중' : '저장'}</button>
            </form>
          </section>
        )}

        {createOpen && (
          <DashboardCreateFlow
            page={page}
            templates={templates}
            onAi={onAi}
            onManual={onManual}
            onTemplate={onTemplate}
            onClose={() => setCreateOpen(false)}
            TemplatesPanelComponent={TemplatesPanelComponent}
          />
        )}

        <section className="home-section">
          <div className="home-section-title">
            <h2>내 랜딩페이지</h2>
            <button type="button" onClick={openCreate}>+ 새로 만들기</button>
          </div>

          {hasPage ? (
            <article className="landing-card">
              <div>
                <strong>{page.title || '랜딩페이지'}</strong>
                <span>/{page.slug || 'my-page'} · 접수 {leadCount}건</span>
              </div>

              <div className="landing-card-actions">
                <button type="button" onClick={onEdit}>편집</button>
                <button type="button" onClick={onPreview}>미리보기</button>
              </div>
            </article>
          ) : (
            <div className="empty-landing">
              <strong>아직 만든 랜딩페이지가 없습니다.</strong>
              <p>새 랜딩 만들기를 눌러 시작하세요.</p>
              <button type="button" onClick={openCreate}>새 랜딩 만들기</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
function DashboardCreateFlow({ page, templates = [], onAi, onManual, onTemplate, onClose, TemplatesPanelComponent = null }) {
  const [step, setStep] = useState('menu');
  const footerBlock = page?.blocks?.find((block) => block.type === 'footer');
  const [footer, setFooter] = useState({
    company: footerBlock?.s?.company || '',
    owner: footerBlock?.s?.owner || '',
    phone: footerBlock?.s?.phone || '',
    address: footerBlock?.s?.address || '',
  });
  const setFooterField = (key, value) => setFooter((current) => ({ ...current, [key]: value }));

  return (
    <section className={`home-create-flow home-create-step-${step}`}>
      <div className="home-create-head">
        <div>
          <span>새 랜딩 만들기</span>
          <h2>{step === 'menu' ? '시작 방식을 선택하세요.' : step === 'ai' ? 'AI로 초안을 만듭니다.' : step === 'manual' ? '기본 정보만 넣고 시작합니다.' : '템플릿을 선택하세요.'}</h2>
          <p>{step === 'menu' ? '아래 3가지 방식 중 하나를 선택하면 이 화면에서 다음 단계가 바로 열립니다.' : '필요한 정보만 입력하고 다음 단계로 진행합니다.'}</p>
        </div>
        <button type="button" onClick={onClose}>닫기</button>
      </div>

      <div className="home-create-options">
        <button type="button" className={step === 'ai' ? 'active primary' : ''} onClick={() => setStep('ai')}>
          <strong>AI 만들기</strong>
          <span>AI 설정과 초안 입력 화면으로 시작합니다.</span>
        </button>
        <button type="button" className={step === 'manual' ? 'active primary' : ''} onClick={() => setStep('manual')}>
          <strong>직접 만들기</strong>
          <span>푸터 기본정보만 입력하고 바로 편집합니다.</span>
        </button>
        <button type="button" className={step === 'template' ? 'active primary' : ''} onClick={() => setStep('template')}>
          <strong>템플릿 만들기</strong>
          <span>실제 예시 화면을 슬라이드로 보고 선택합니다.</span>
        </button>
      </div>

      {step === 'ai' && (
        <div className="home-create-ai-panel">
          <AiStartBasics onStart={onAi}/>
        </div>
      )}

      {step === 'manual' && (
        <div className="home-create-footer-form">
          <label><span>상호명</span><input value={footer.company} onChange={(e) => setFooterField('company', e.target.value)} placeholder="예: 페이지로 상담센터" /></label>
          <label><span>대표자</span><input value={footer.owner} onChange={(e) => setFooterField('owner', e.target.value)} placeholder="예: 홍길동" /></label>
          <label><span>연락처</span><input value={footer.phone} onChange={(e) => setFooterField('phone', e.target.value)} placeholder="010-0000-0000" /></label>
          <label><span>주소</span><input value={footer.address} onChange={(e) => setFooterField('address', e.target.value)} placeholder="사업장 주소" /></label>
          <button type="button" onClick={() => onManual?.(footer)}>직접 만들기 시작</button>
        </div>
      )}

      {step === 'template' && (
        <div className="home-create-template">
          <TemplatePanelSlot Component={TemplatesPanelComponent} page={page} templates={templates} onApply={onTemplate} />
        </div>
      )}
    </section>
  );
}

function TemplateChoiceCard({ template, onSelect }) {
  const tagText = template.chips?.slice(0, 3).join(' · ');

  return (
    <button type="button" className="template-choice-card" onClick={() => onSelect?.(template.id)}>
      <div className="template-choice-topline">
        <strong>{template.name}</strong>
        {tagText && <em>{tagText}</em>}
      </div>
      <span>{template.summary}</span>
    </button>
  );
}

function AiStartBasics({ onStart }) {
  const [form, setForm] = useState({
    prompt: '',
    industry: '',
    serviceName: '',
    goal: '상담신청',
    contactMethod: '상담폼',
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="create-ai-basics">
      <div className="create-ai-basics-head">
        <strong>기본 정보 저장</strong>
        <p>API 키 없이도 제작 방향을 먼저 저장합니다. 이후 AI 설정에서 키를 연결하면 이 입력값으로 바로 초안을 만들 수 있습니다.</p>
      </div>

      <label className="wide">
        <span>만들고 싶은 페이지</span>
        <textarea value={form.prompt} onChange={(e)=>set('prompt', e.target.value)} placeholder="예: 부평 피부관리샵 첫 방문 예약 랜딩. 민감성 피부 상담, 예약폼이 필요해." />
      </label>
      <label>
        <span>업종/키워드</span>
        <input value={form.industry} onChange={(e)=>set('industry', e.target.value)} placeholder="예: 피부관리샵, 세무 상담" />
      </label>
      <label>
        <span>서비스명</span>
        <input value={form.serviceName} onChange={(e)=>set('serviceName', e.target.value)} placeholder="예: 바른케어" />
      </label>
      <label>
        <span>목적</span>
        <select value={form.goal} onChange={(e)=>set('goal', e.target.value)}>
          <option value="상담신청">상담신청</option>
          <option value="방문예약">방문예약</option>
          <option value="견적문의">견적문의</option>
          <option value="이벤트 신청">이벤트 신청</option>
          <option value="상품문의">상품문의</option>
        </select>
      </label>
      <label>
        <span>연락 방식</span>
        <select value={form.contactMethod} onChange={(e)=>set('contactMethod', e.target.value)}>
          <option value="상담폼">상담 폼</option>
          <option value="방문예약">방문 예약</option>
          <option value="전화">전화</option>
          <option value="카카오톡">카카오톡</option>
          <option value="상담폼+전화">상담 폼 + 전화</option>
        </select>
      </label>

      <button type="button" onClick={() => onStart?.({ ...form, inputMode: 'detail' })}>저장하고 AI 설정 열기</button>
    </div>
  );
}

function CreateLandingModal({ page, onClose, onAi, onManual, onTemplate, templates = [], TemplatesPanelComponent = null }) {
  const [step, setStep] = useState('menu');
  const dialogRef = useRef(null);
  const [footer, setFooter] = useState({
    company: page?.blocks?.find((block) => block.type === 'footer')?.s?.company || '',
    owner: page?.blocks?.find((block) => block.type === 'footer')?.s?.owner || '',
    phone: page?.blocks?.find((block) => block.type === 'footer')?.s?.phone || '',
    address: page?.blocks?.find((block) => block.type === 'footer')?.s?.address || '',
  });
  const setFooterField = (key, value) => setFooter((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const focusable = dialogRef.current?.querySelector?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus?.();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className={`create-modal create-flow-${step}`} role="dialog" aria-modal="true" aria-labelledby="create-landing-title">
        <button className="create-modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>

        {step !== 'menu' && (
          <button className="create-modal-back" type="button" onClick={() => setStep('menu')}>← 선택으로</button>
        )}

        {step === 'menu' && (
          <>
            <div className="create-modal-title">
              <span>새 랜딩 만들기</span>
              <h2 id="create-landing-title">어떻게 시작할까요?</h2>
              <p>시작 방식만 먼저 고르고, 다음 화면에서 필요한 정보만 입력합니다.</p>
            </div>

            <div className="create-options create-mode-options">
              <button type="button" className="primary" onClick={() => setStep('ai')}>
                <strong>AI 만들기</strong>
                <span>AI 설정과 초안 입력 화면으로 시작합니다.</span>
              </button>

              <button type="button" onClick={() => setStep('manual')}>
                <strong>직접 만들기</strong>
                <span>푸터 기본정보만 입력하고 바로 편집합니다.</span>
              </button>

              <button type="button" onClick={() => setStep('template')}>
                <strong>템플릿 만들기</strong>
                <span>실제 예시 화면을 넘겨보고 선택합니다.</span>
              </button>
            </div>
          </>
        )}

        {step === 'ai' && (
          <div className="create-step-panel">
            <div className="create-modal-title">
              <span>AI 만들기</span>
              <h2 id="create-landing-title">기본 정보를 먼저 저장합니다.</h2>
              <p>API 키는 지금 입력하지 않습니다. 제작 방향만 저장하고 AI 설정 화면에서 나중에 연결합니다.</p>
            </div>
            <AiStartBasics onStart={onAi}/>
          </div>
        )}

        {step === 'manual' && (
          <div className="create-step-panel">
            <div className="create-modal-title">
              <span>직접 만들기</span>
              <h2 id="create-landing-title">기본 정보만 넣고 시작합니다.</h2>
              <p>푸터에 들어갈 최소 정보만 먼저 입력합니다. 나머지는 편집 화면에서 구성합니다.</p>
            </div>
            <div className="create-footer-form">
              <label><span>상호명</span><input value={footer.company} onChange={(e) => setFooterField('company', e.target.value)} placeholder="예: 페이지로 상담센터" /></label>
              <label><span>대표자</span><input value={footer.owner} onChange={(e) => setFooterField('owner', e.target.value)} placeholder="예: 홍길동" /></label>
              <label><span>연락처</span><input value={footer.phone} onChange={(e) => setFooterField('phone', e.target.value)} placeholder="010-0000-0000" /></label>
              <label><span>주소</span><input value={footer.address} onChange={(e) => setFooterField('address', e.target.value)} placeholder="사업장 주소" /></label>
              <button type="button" onClick={() => onManual?.(footer)}>직접 만들기 시작</button>
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="create-template-step">
            <h2 id="create-landing-title" className="sr-only">템플릿을 선택하세요.</h2>
            <TemplatePanelSlot Component={TemplatesPanelComponent} page={page} templates={templates} onApply={onTemplate} />
          </div>
        )}
      </section>
    </div>
  );
}

function StartModeOverlay({ onManual, onAi, onTemplate, onClose, templates = [] }) {
  return (
    <div className="start-mode-overlay">
      <div className="start-mode-card">
        <button type="button" className="start-mode-close" aria-label="시작 방식 선택 닫기" onClick={onClose}>
          ×
        </button>
        <div className="start-mode-title">
          <span>시작 방식 선택</span>
          <h2>처음 화면을 어떻게 만들까요?</h2>
          <p>AI 초안으로 빠르게 시작하거나, 직접 편집으로 바로 만들 수 있습니다.</p>
        </div>

        <div className="start-mode-actions">
          <button type="button" className="primary" onClick={onAi}>
            <strong>AI 초안으로 시작</strong>
            <span>설정의 AI 생성 화면으로 이동해서 기본 화면을 먼저 만듭니다.</span>
          </button>
          <button type="button" onClick={onManual}>
            <strong>직접 만들기</strong>
            <span>현재 편집 화면에서 바로 수동으로 구성합니다.</span>
          </button>
          <button type="button" onClick={onTemplate}>
            <strong>템플릿으로 시작</strong>
            <span>목적에 맞는 기본 화면을 먼저 만든 뒤 수정합니다.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { PublicHome, AuthScreen, Dashboard, CreateLandingModal, StartModeOverlay };
import './HomeScreens.css';

