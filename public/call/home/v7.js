(() => {
  const STYLE_ID = 'calllink-v7-inline-style';
  const styleText = `
    .ease-section{min-height:auto!important;padding:110px 0!important;background:#111827!important;color:#fff!important}
    .v7-ease-grid{display:grid;grid-template-columns:minmax(0,.82fr) minmax(520px,1.18fr);gap:62px;align-items:center;text-align:left}
    .v7-ease-copy .story-title{margin-left:0!important;text-align:left!important}
    .v7-ease-copy .story-kicker{color:#2f6df6!important}
    .v7-ease-copy .accent{color:#2f6df6!important}
    .v7-timeline{position:relative;padding:24px 28px;border:1px solid rgba(255,255,255,.14);border-radius:30px;background:rgba(255,255,255,.055);box-shadow:0 28px 70px rgba(0,0,0,.2)}
    .v7-timeline:before{content:"";position:absolute;left:61px;top:62px;bottom:62px;width:2px;background:rgba(255,255,255,.12)}
    .v7-event{position:relative;display:grid;grid-template-columns:64px 1fr;gap:18px;align-items:start;padding:17px 0}
    .v7-event+.v7-event{border-top:1px solid rgba(255,255,255,.08)}
    .v7-time{padding-top:7px;color:rgba(255,255,255,.55);font-size:12px;font-weight:850}
    .v7-event-card{position:relative;padding:18px 20px;border-radius:19px;color:#111827;background:#fff}
    .v7-event-card:before{content:"";position:absolute;left:-31px;top:22px;width:12px;height:12px;border:4px solid #111827;border-radius:50%;background:#2f6df6;box-shadow:0 0 0 6px rgba(47,109,246,.17)}
    .v7-event-card strong{display:block;font-size:18px;letter-spacing:-.04em}
    .v7-event-card span{display:block;margin-top:5px;color:#667085;font-size:12px}
    .v7-event-card.auto{color:#fff;background:#2f6df6}
    .v7-event-card.auto span{color:rgba(255,255,255,.78)}
    .v7-event-card.auto:before{border-color:#2f6df6;background:#fff}
    .v7-benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;grid-column:1/-1;margin-top:-16px}
    .v7-benefit{padding:17px 18px;border:1px solid rgba(255,255,255,.13);border-radius:17px;background:rgba(255,255,255,.05);color:#fff;text-align:center;font-size:16px;font-weight:900}
    .fit-section{min-height:auto!important;padding:112px 0!important;background:#f4f6fa!important}
    .v7-fit-intro{max-width:850px;margin:0 auto;text-align:center}
    .v7-fit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:46px;text-align:left}
    .v7-fit-card{overflow:hidden;border:1px solid rgba(17,24,39,.11);border-radius:27px;background:#fff;box-shadow:0 22px 55px rgba(17,24,39,.07)}
    .v7-fit-head{padding:22px 23px 18px;border-bottom:1px solid rgba(17,24,39,.1)}
    .v7-fit-number{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:10px;color:#fff;background:#111827;font-size:11px;font-weight:950}
    .v7-fit-head h3{margin:16px 0 0;font-size:24px;line-height:1.2;letter-spacing:-.05em}
    .v7-fit-body{padding:20px;background:#f7f8fb}
    .v7-fit-bubble{padding:16px;border-radius:17px 17px 5px 17px;color:#fff;background:#2f6df6;font-size:13px;line-height:1.58;box-shadow:0 14px 30px rgba(47,109,246,.18)}
    .v7-fit-bubble small{display:block;margin-top:9px;color:rgba(255,255,255,.68);font-size:10px}
    .v7-fit-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}
    .v7-fit-tags span{padding:7px 9px;border:1px solid rgba(17,24,39,.11);border-radius:999px;background:#fff;color:#475467;font-size:10px;font-weight:850}
    .v7-enter{animation:v7-rise .62s cubic-bezier(.2,.8,.2,1) both}
    .v7-delay-1{animation-delay:.08s}.v7-delay-2{animation-delay:.16s}.v7-delay-3{animation-delay:.24s}
    @keyframes v7-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
    @media(max-width:1020px){
      .v7-ease-grid{grid-template-columns:1fr;gap:44px}
      .v7-ease-copy .story-title{text-align:center!important;margin-left:auto!important}
      .v7-ease-copy{text-align:center}
      .v7-fit-grid{grid-template-columns:1fr 1fr}
      .v7-fit-card:last-child{grid-column:1/-1;width:calc(50% - 9px);justify-self:center}
    }
    @media(max-width:720px){
      .ease-section,.fit-section{padding:86px 0!important}
      .v7-ease-grid{gap:34px}
      .v7-timeline{padding:18px 15px}
      .v7-timeline:before{left:48px}
      .v7-event{grid-template-columns:46px 1fr;gap:13px;padding:14px 0}
      .v7-event-card:before{left:-24px}
      .v7-benefits{grid-template-columns:1fr;margin-top:0}
      .v7-fit-grid{grid-template-columns:1fr;margin-top:38px}
      .v7-fit-card,.v7-fit-card:last-child{width:100%;grid-column:auto}
      .v7-fit-intro .story-title.medium{font-size:36px}
    }
    @media(prefers-reduced-motion:reduce){.v7-enter{animation:none!important}}
  `;

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = styleText;
    document.head.appendChild(style);
  };

  const render = () => {
    ensureStyle();

    const ease = document.querySelector('.ease-section');
    if (ease) {
      ease.innerHTML = `
        <div class="shell">
          <div class="v7-ease-grid">
            <div class="v7-ease-copy v7-enter">
              <p class="story-kicker">쓰면 편해지는 점</p>
              <h2 class="story-title medium">통화가 끝나면,<br><span class="accent">다음 일로.</span></h2>
            </div>
            <div class="v7-timeline v7-enter v7-delay-1">
              <div class="v7-event"><span class="v7-time">14:18</span><div class="v7-event-card"><strong>상담 종료</strong><span>예약 안내 통화 완료</span></div></div>
              <div class="v7-event"><span class="v7-time">14:18</span><div class="v7-event-card auto"><strong>문자 자동 발송</strong><span>예약시간 · 위치 전송</span></div></div>
              <div class="v7-event"><span class="v7-time">14:19</span><div class="v7-event-card"><strong>다음 상담</strong><span>별도 문자 작성 없음</span></div></div>
            </div>
            <div class="v7-benefits v7-enter v7-delay-2"><div class="v7-benefit">문구 재사용</div><div class="v7-benefit">즉시 발송</div><div class="v7-benefit">내역 확인</div></div>
          </div>
        </div>`;
    }

    const fit = document.querySelector('.fit-section');
    if (fit) {
      fit.innerHTML = `
        <div class="shell">
          <div class="v7-fit-intro v7-enter">
            <p class="story-kicker">이런 통화에 바로 사용</p>
            <h2 class="story-title medium">통화 뒤에<br><span class="accent">문자가 남는 업무.</span></h2>
          </div>
          <div class="v7-fit-grid">
            <article class="v7-fit-card v7-enter v7-delay-1"><div class="v7-fit-head"><span class="v7-fit-number">01</span><h3>예약·방문 안내</h3></div><div class="v7-fit-body"><div class="v7-fit-bubble">예약은 8월 3일 오후 2시입니다.<br>위치와 주차 안내를 확인해주세요.<small>통화 종료 후 자동 발송</small></div><div class="v7-fit-tags"><span>병원</span><span>미용실</span><span>학원</span></div></div></article>
            <article class="v7-fit-card v7-enter v7-delay-2"><div class="v7-fit-head"><span class="v7-fit-number">02</span><h3>견적·상담 안내</h3></div><div class="v7-fit-body"><div class="v7-fit-bubble">상담드린 견적과 필요서류를 보내드립니다.<br>검토 후 답장해주세요.<small>통화 종료 후 자동 발송</small></div><div class="v7-fit-tags"><span>부동산</span><span>보험</span><span>자동차</span><span>법무</span></div></div></article>
            <article class="v7-fit-card v7-enter v7-delay-3"><div class="v7-fit-head"><span class="v7-fit-number">03</span><h3>문의·후속 안내</h3></div><div class="v7-fit-body"><div class="v7-fit-bubble">문의하신 상품과 주문 링크입니다.<br>추가 문의는 문자로 남겨주세요.<small>통화 종료 후 자동 발송</small></div><div class="v7-fit-tags"><span>쇼핑몰</span><span>출장서비스</span><span>상담업</span></div></div></article>
          </div>
        </div>`;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();