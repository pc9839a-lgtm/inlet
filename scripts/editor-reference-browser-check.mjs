// The owner reference defines the chrome. Content below is a disposable QA page.
export async function checkReferenceEditor({ client, evaluate, assert, waitForBrowser, clickPointer, setInputValue, focusSelector, pressKeyboardKey, capture, setViewport, apiState }) {
  await setViewport(client, 1672, 941, false);
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('.text-editor-flow') && document.querySelector('.inspector-navigation')?.querySelectorAll('button').length >= 3`, 'reference text inspector');
  const before = await evaluate(client, `[...document.querySelectorAll('.text-editor-flow textarea')].map(el => el.value)`);
  const title = '.text-editor-flow textarea';
  await clickPointer(client, title);
  await setInputValue(client, title, '더 나은 세상을 만드는\n당신의 아이디어');
  await clickPointer(client, 'input[aria-label="제목 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="제목 크기 (px)"]', '48');
  await focusSelector(client, 'input[aria-label="본문 크기 (px)"]');
  await waitForBrowser(client, `getComputedStyle(document.querySelector('.phone-frame #block-editor-text h2')).fontSize === '48px'`, 'title pixel size changes the actual page');
  await clickPointer(client, 'button[aria-label="제목 크기 늘리기"]');
  await waitForBrowser(client, `getComputedStyle(document.querySelector('.phone-frame #block-editor-text h2')).fontSize === '49px'`, 'title stepper increments');
  await clickPointer(client, 'button[aria-label="제목 크기 줄이기"]');
  await waitForBrowser(client, `getComputedStyle(document.querySelector('.phone-frame #block-editor-text h2')).fontSize === '48px'`, 'title stepper decrements');
  await clickPointer(client, 'input[aria-label="본문 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="본문 크기 (px)"]', '18');
  await focusSelector(client, 'input[aria-label="글자색 HEX"]');
  await setInputValue(client, 'input[aria-label="글자색 HEX"]', '#175CD3');
  await focusSelector(client, 'input[aria-label="제목 크기 (px)"]');
  await waitForBrowser(client, `getComputedStyle(document.querySelector('.phone-frame #block-editor-text h2')).color === 'rgb(23, 92, 211)'`, 'text color changes the actual page');
  await focusSelector(client, 'input[aria-label="글자색 HEX"]');
  await setInputValue(client, 'input[aria-label="글자색 HEX"]', '#111827');
  await focusSelector(client, 'input[aria-label="제목 크기 (px)"]');
  await waitForBrowser(client, `getComputedStyle(document.querySelector('.phone-frame #block-editor-text h2')).color === 'rgb(17, 24, 39)'`, 'text color reset');
  await evaluate(client, `document.querySelector('.editor-inspector-panel').scrollTop = 0`);

  const geometry = await evaluate(client, `(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,top:r.top,height:r.height}; };
    const stage = document.querySelector('.preview-workspace');
    const list = document.querySelector('.editor-composition-panel');
    const inspector = document.querySelector('.editor-inspector-panel');
    return { header: rect(document.querySelector('.workspace-persistent-header')), list:rect(list), inspector:rect(inspector), stage:rect(stage), phone:rect(document.querySelector('.phone-frame')), pageWidth:document.querySelector('.phone-frame .landing-page').clientWidth,
      phones:stage.querySelectorAll('.phone-frame').length, stageChildren:stage.children.length, widthOptions:stage.querySelectorAll('.preview-width-option').length, documentWidth:document.documentElement.scrollWidth,
      listScroll:getComputedStyle(list).overflowY, inspectorScroll:getComputedStyle(inspector).overflowY, redundantNav:!!document.querySelector('.workspace-persistent-header > .workspace-editor-nav') };
  })()`);
  console.log('reference geometry:', JSON.stringify(geometry));
  await capture(client, 'desktop-reference-editor-1672');
  assert(Math.abs(geometry.header.height - 64) <= 1 && geometry.list.width >= 270 && geometry.list.width <= 278 && geometry.inspector.width >= 388 && geometry.inspector.width <= 398, 'reference viewport must reproduce its three working regions: ' + JSON.stringify(geometry));
  assert(geometry.pageWidth === 390 && geometry.phones === 1 && geometry.stageChildren === 1 && geometry.widthOptions === 0 && geometry.documentWidth <= 1672 && !geometry.redundantNav && geometry.listScroll === 'auto' && geometry.inspectorScroll === 'auto', 'reference editor must keep actual page only, no marketing panel, and independent reachable columns: ' + JSON.stringify(geometry));

  // Zoom changes only the viewing scale; the page's layout width stays 390px.
  await evaluate(client, `(() => { const el = document.querySelector('select[aria-label="미리보기 배율"]'); el.value='75'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitForBrowser(client, `document.querySelector('.phone-frame').getBoundingClientRect().width < 310 && document.querySelector('.phone-frame .landing-page').clientWidth === 390`, 'preview zoom scales the view without changing page layout');
  await evaluate(client, `(() => { const el = document.querySelector('select[aria-label="미리보기 배율"]'); el.value='100'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitForBrowser(client, `document.querySelector('.phone-frame').getBoundingClientRect().width >= 400`, 'preview zoom reset');

  const menu = '.workspace-editor-nav > summary';
  await focusSelector(client, menu);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('.workspace-editor-nav').open && document.querySelector('#workspace-tab-inbox').getClientRects().length > 0`, 'workspace menu opens by keyboard');
  await pressKeyboardKey(client, 'Escape');
  assert(await evaluate(client, `!document.querySelector('.workspace-editor-nav').open && document.activeElement === document.querySelector('.workspace-editor-nav > summary')`), 'workspace menu Escape restores trigger focus');
  await clickPointer(client, '.add-toggle');
  await waitForBrowser(client, `!!document.querySelector('.add-panel')`, 'compact add catalog');
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client, `!document.querySelector('.add-panel')`, 'compact add catalog Escape');
  await clickPointer(client, '.inspector-navigation button:last-child');
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .block-editor-advanced-settings').open`, 'inspector advanced navigation opens the real anchor control');
  await clickPointer(client, '.inspector-navigation button:first-child');
  await waitForBrowser(client, `document.querySelector('.editor-inspector-panel').scrollTop === 0`, 'inspector content navigation returns to its own top');

  await waitForBrowser(client, `getComputedStyle(document.querySelector('.preview-selection-toolbar')).visibility === 'visible'`, 'selected preview action bar');
  await clickPointer(client, '.preview-selection-toolbar button[aria-label="블록 위로 이동"]');
  await waitForBrowser(client, `document.querySelector('.screen-order-v2-list .screen-order-v2-item')?.id === 'editor-block-editor-text'`, 'preview action moves the actual block up');
  await clickPointer(client, '.preview-selection-toolbar button[aria-label="블록 아래로 이동"]');
  await waitForBrowser(client, `document.querySelector('.screen-order-v2-list .screen-order-v2-item')?.id === 'editor-block-editor-hero'`, 'preview action restores the actual block order');

  await setInputValue(client, title, before[0]);
  await focusSelector(client, 'input[aria-label="제목 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="제목 크기 (px)"]', '24');
  await focusSelector(client, 'input[aria-label="본문 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="본문 크기 (px)"]', '15');
  await focusSelector(client, title);
  assert(apiState.saveCount === 0, 'reference editor actions must stay local until explicit publish');
  await setViewport(client, 1280, 900, false);
}
