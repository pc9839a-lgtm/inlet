(() => {
  const render = () => {
    const ease = document.querySelector('.ease-section');
    if (ease) {
      ease.innerHTML = `
        <div class="shell">
          <div class="v6-ease-grid">
            <div class="v6-ease-copy v6-enter">
              <p class="story-kicker">쓰면 편해지는 점</p>
              <h2 class="story-title medium">통화가 끝나면,<br><span class="accent">다음 일로.</span></h2>
            </div>
            <div class="v6-timeline v6-enter v6-delay-1">
              <div class="v6-event"><span class="v6-time">14:18</span><div class="v6-event-card"><strong>상담 종료</strong><span>예약 안내 통화 완료</span></div></div>
              <div class="v6-event"><span class="v6-time">14:18</span><div class="v6-event-card auto"><strong>문자 자동 발송</strong><span>예약시간 · 위치 전송</span></div></div>
              <div class="v6-event"><span class="v6-time">14:19</span><div class="v6-event-card"><strong>다음 상담</strong><span>별도 문자 작성 없음</span></div></div>
            </div>
            <div class="v6-benefits v6-enter v6-delay-2"><div class="v6-benefit">문구 재사용</div><div class="v6-benefit">즉시 발송</div><div class="v6-benefit">내역 확인</div></div>
          </div>
        </div>`;
    }

    const fit = document.querySelector('.fit-section');
    if (fit) {
      fit.innerHTML = `
        <div class="shell">
          <div class="v6-fit-intro v6-enter">
            <p class="story-kicker">이런 통화에 바로 사용</p>
            <h2 class="story-title medium">통화 뒤에<br><span class="accent">문자가 남는 업무.</span></h2>
          </div>
          <div class="v6-fit-grid">
            <article class="v6-fit-card v6-enter v6-delay-1"><div class="v6-fit-head"><span class="v6-fit-number">01</span><h3>예약·방문 안내</h3></div><div class="v6-fit-body"><div class="v6-fit-bubble">예약은 8월 3일 오후 2시입니다.<br>위치와 주차 안내를 확인해주세요.<small>통화 종료 후 자동 발송</small></div><div class="v6-fit-tags"><span>병원</span><span>미용실</span><span>학원</span></div></div></article>
            <article class="v6-fit-card v6-enter v6-delay-2"><div class="v6-fit-head"><span class="v6-fit-number">02</span><h3>견적·상담 안내</h3></div><div class="v6-fit-body"><div class="v6-fit-bubble">상담드린 견적과 필요서류를 보내드립니다.<br>검토 후 답장해주세요.<small>통화 종료 후 자동 발송</small></div><div class="v6-fit-tags"><span>부동산</span><span>보험</span><span>자동차</span><span>법무</span></div></div></article>
            <article class="v6-fit-card v6-enter v6-delay-3"><div class="v6-fit-head"><span class="v6-fit-number">03</span><h3>문의·후속 안내</h3></div><div class="v6-fit-body"><div class="v6-fit-bubble">문의하신 상품과 주문 링크입니다.<br>추가 문의는 문자로 남겨주세요.<small>통화 종료 후 자동 발송</small></div><div class="v6-fit-tags"><span>쇼핑몰</span><span>출장서비스</span><span>상담업</span></div></div></article>
          </div>
        </div>`;
    }

    document.querySelectorAll('.stagger.reveal').forEach((element) => element.classList.add('is-visible'));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();