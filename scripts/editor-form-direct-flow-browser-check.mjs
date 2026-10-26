// Runs inside the authenticated editor fixture; never targets production data.
export async function checkFormDirectFlow({ client, evaluate, assert, waitForBrowser, clickPointer, setInputValue, focusSelector, pressKeyboardKey, capture, setViewport, apiState }) {
  await clickPointer(client, '#editor-block-editor-form .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('.form-editor-flow')`, 'direct form editor loaded');
  const initial = await evaluate(client, `(() => {
    const root = document.querySelector('.form-editor-flow');
    return {
      tabs: root.querySelectorAll('[role="tablist"]').length,
      questionCount: root.querySelectorAll('.form-question-card').length,
      expandedQuestions: root.querySelectorAll('.form-question-card.open').length,
      settingsClosed: [...root.querySelectorAll('.form-basic-detail')].every(el => !el.open),
      hiddenSettings: [...root.querySelectorAll('.form-basic-detail > div')].every(el => !el.getClientRects().length),
      addClosed: !root.querySelector('.form-question-add').open,
      hiddenAdd: !root.querySelector('.form-question-tools').getClientRects().length,
      headerActions: root.querySelectorAll('.form-question-head-row .icon-only').length,
    };
  })()`);
  assert(initial.tabs === 0 && initial.questionCount === 2 && initial.expandedQuestions === 0
    && initial.settingsClosed && initial.hiddenSettings && initial.addClosed && initial.hiddenAdd
    && initial.headerActions === 0, 'form overview must show editable content and compact questions without secondary controls: ' + JSON.stringify(initial));
  await setViewport(client, 1440, 960, false);
  await capture(client, 'desktop-form-direct-overview');

  await clickPointer(client, '.form-basic-grid input');
  await setInputValue(client, '.form-basic-grid input', '상담 신청 · 변경 확인');
  await clickPointer(client, '.form-editor-flow > .field input');
  await setInputValue(client, '.form-editor-flow > .field input', '상담 예약하기');
  await waitForBrowser(client, `(document.querySelector('.phone-frame #block-editor-form')?.innerText || '').includes('상담 신청 · 변경 확인') && document.querySelector('.phone-frame #block-editor-form button[type="submit"]')?.textContent.includes('상담 예약하기')`, 'form title and submit text update preview without tabs');

  const addSummary = '.form-question-add > summary';
  await focusSelector(client, addSummary);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('.form-question-add')?.open`, 'keyboard add picker');
  await pressKeyboardKey(client, 'Escape');
  assert(await evaluate(client, `!document.querySelector('.form-question-add').open && document.activeElement === document.querySelector('.form-question-add > summary')`), 'Escape must close the add picker and return focus');
  await clickPointer(client, addSummary);
  await clickPointer(client, '.form-question-tools button:nth-child(7)');
  await waitForBrowser(client, `document.querySelectorAll('.form-question-card').length === 3 && !!document.querySelector('.form-question-card.open .option-editor') && !document.querySelector('.form-question-add').open`, 'new choice question opens with options and closes picker');
  const longLabel = '상담 전에 확인하고 싶은 내용과 연락받기 편한 시간을 선택해 주세요';
  await clickPointer(client, '.form-question-card.open .form-question-body > .field input');
  await setInputValue(client, '.form-question-card.open .form-question-body > .field input', longLabel);
  await evaluate(client, `(() => { const el = document.querySelector('.form-question-card.open select'); el.value = 'multi'; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await clickPointer(client, '.form-question-card.open .option-editor-row input');
  await setInputValue(client, '.form-question-card.open .option-editor-row input', '평일 오후');
  await clickPointer(client, '.form-question-card.open [role="switch"]');
  await waitForBrowser(client, `document.querySelector('.form-question-card.open [role="switch"]')?.getAttribute('aria-checked') === 'true'`, 'question required toggle');
  const titleGeometry = await evaluate(client, `(() => { const el = document.querySelector('.form-question-card.open .form-question-identity strong'); const card = el.closest('.form-question-card'); return { width: el.getBoundingClientRect().width, cardWidth: card.getBoundingClientRect().width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, title: el.textContent, titleHeight: el.getBoundingClientRect().height, headerHeight: card.querySelector('.form-question-head-row').getBoundingClientRect().height }; })()`);
  assert(titleGeometry.width > titleGeometry.cardWidth * .55 && titleGeometry.scrollWidth <= titleGeometry.clientWidth + 1 && titleGeometry.titleHeight <= titleGeometry.headerHeight && titleGeometry.title === longLabel, 'long Korean question name must fit the row and wrap within the available header: ' + JSON.stringify(titleGeometry));
  await capture(client, 'desktop-form-choice-edit');
  for (const width of [900, 1024]) {
    await setViewport(client, width, 900, false);
    assert(await evaluate(client, `(() => { const root = document.querySelector('.form-editor-flow'); return root.scrollWidth <= root.clientWidth + 1 && [...root.querySelectorAll('input,select,button')].filter(el => el.getClientRects().length).every(el => el.getBoundingClientRect().width <= root.getBoundingClientRect().width + 1); })()`), 'form controls must fit the inspector at ' + width);
    await capture(client, 'desktop-form-choice-' + width);
  }
  await setViewport(client, 1440, 960, false);
  await clickPointer(client, '.form-question-card.open .form-question-actions button:nth-child(3)');
  await waitForBrowser(client, `document.querySelectorAll('.form-question-card').length === 4 && document.querySelector('.form-question-card.open .form-question-identity strong')?.textContent.endsWith('복사')`, 'question duplicate selected');
  const copied = await evaluate(client, `({type: document.querySelector('.form-question-card.open select')?.value, option: document.querySelector('.form-question-card.open .option-editor-row input')?.value, required: document.querySelector('.form-question-card.open [role="switch"]')?.getAttribute('aria-checked')})`);
  assert(copied.type === 'multi' && copied.option === '평일 오후' && copied.required === 'true', 'duplicate must retain question type, options and required state: ' + JSON.stringify(copied));
  await clickPointer(client, '.form-question-card.open .form-question-actions button:first-child');
  await waitForBrowser(client, `document.querySelectorAll('.form-question-card')[2]?.classList.contains('open')`, 'keyboard alternative moves question up');
  await clickPointer(client, '.form-question-card.open .form-question-actions .danger');
  await waitForBrowser(client, `document.querySelectorAll('.form-question-card').length === 3`, 'remove duplicate question');
  await clickPointer(client, '.form-question-card:last-child .form-question-title');
  await waitForBrowser(client, `document.querySelector('.form-question-card:last-child')?.classList.contains('open')`, 'original choice question');
  await clickPointer(client, '.form-question-card.open .form-question-actions .danger');
  await waitForBrowser(client, `document.querySelectorAll('.form-question-card').length === 2`, 'remove temporary choice question');

  await focusSelector(client, '.form-design-detail > summary');
  await pressKeyboardKey(client, 'Space');
  await waitForBrowser(client, `document.querySelector('.form-design-detail')?.open`, 'keyboard opens form design');
  assert(await evaluate(client, `document.querySelector('.form-basic-grid input')?.value === '상담 신청 · 변경 확인' && document.querySelectorAll('.form-design-detail [aria-expanded]').length === 0`), 'design disclosure must preserve primary fields without nested disclosure controls');
  await capture(client, 'desktop-form-design');
  await clickPointer(client, '.form-design-detail > summary');
  await clickPointer(client, '.form-basic-detail:has(.privacy-compact-panel) > summary');
  await waitForBrowser(client, `document.querySelector('.privacy-compact-panel')?.getClientRects().length > 0`, 'privacy controls reachable');
  await clickPointer(client, '.privacy-compact-panel [role="switch"]');
  await waitForBrowser(client, `document.querySelector('.privacy-compact-panel [role="switch"]')?.getAttribute('aria-checked') === 'false'`, 'privacy requirement disabled in draft');
  await clickPointer(client, '.privacy-compact-panel [role="switch"]');
  await clickPointer(client, '.form-basic-detail:has(.privacy-compact-panel) > summary');
  await clickPointer(client, '.form-duplicate-detail > summary');
  await waitForBrowser(client, `document.querySelector('.form-duplicate-detail')?.open`, 'duplicate policy reachable');
  await clickPointer(client, '.form-duplicate-detail > summary');
  await clickPointer(client, '.form-embed-button');
  await waitForBrowser(client, `!!document.querySelector('.inlet-html-modal[role="dialog"]')`, 'external embed dialog');
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client, `!document.querySelector('.inlet-html-modal')`, 'external embed Escape');
  assert(await evaluate(client, `document.activeElement === document.querySelector('.form-embed-button')`), 'embed close must return focus to its trigger');
  assert(apiState.saveCount === 0, 'form edits, question actions and disclosures must not publish');
  await setViewport(client, 1280, 900, false);
}
