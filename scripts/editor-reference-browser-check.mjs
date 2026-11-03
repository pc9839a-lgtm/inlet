// The owner reference defines the chrome. Content below is a disposable QA page.
export async function checkReferenceEditor({ client, evaluate, assert, waitForBrowser, clickPointer, setInputValue, focusSelector, pressKeyboardKey, capture, setViewport, apiState }) {
  await setViewport(client, 1672, 941, false);
  // Prior QA scenarios may leave a block selected. Explicitly enter page-level
  // editing to verify that clearing the selected block never hides the inspector.
  await clickPointer(client, '.editor-page-settings-button');
  await waitForBrowser(client, `!!document.querySelector('.editor-page-options-stack')`,
    'unselected page shows real design controls in the permanent inspector');
  const unselected = await evaluate(client, `(() => {
    const pageOptions = document.querySelector('.editor-page-options-stack');
    const inspector = document.querySelector('.editor-inspector-panel');
    const composition = document.querySelector('.editor-composition-panel');
    const work = document.querySelector('.work-panel');
    const preview = document.querySelector('.preview-workspace');
    return { hasPageOptions:!!pageOptions, inspectorDisplay:getComputedStyle(inspector).display,
      listWidth:composition.getBoundingClientRect().width, inspectorWidth:inspector.getBoundingClientRect().width,
      editorWidth:work.getBoundingClientRect().width, previewWidth:preview.getBoundingClientRect().width };
  })()`);
  assert(unselected.hasPageOptions && unselected.inspectorDisplay !== 'none'
    && unselected.editorWidth >= 698 && unselected.listWidth >= 258 && unselected.inspectorWidth >= 438,
    'no-selection must show actual page controls in the wide left editor: ' + JSON.stringify(unselected));
  // Stress-test the block composition with 30+ rows. Clones are DOM-only
  // and removed in the same task; no app data, draft or publishing state changes.
  const longPage = await evaluate(client, `(() => {
    const list = document.querySelector('.screen-order-v2-list');
    const owner = document.querySelector('.work-panel');
    const originalRows = [...list.querySelectorAll('.screen-order-v2-slot')];
    const seed = originalRows[0];
    if (!seed || !owner) return null;
    const clones = [];
    try {
      for (let i = 0; i < 28; i++) {
        const clone = seed.cloneNode(true);
        clone.dataset.qaClone = String(i);
        clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        list.appendChild(clone);
        clones.push(clone);
      }
      const rows = [...list.querySelectorAll('.screen-order-v2-slot')];
      const overlapping = rows.some((row) => {
        const identity = row.querySelector('.screen-order-v2-identity-copy strong');
        const buttons = row.querySelectorAll('.screen-order-v2-visibility-button, .screen-order-v2-action');
        if (!identity || !buttons.length) return false;
        const t = identity.getBoundingClientRect();
        return [...buttons].some(button => {
          const b = button.getBoundingClientRect();
          return t.left < b.right && t.right > b.left && t.top < b.bottom && t.bottom > b.top;
        });
      });
      const scrollMax = Math.max(0, owner.scrollHeight - owner.clientHeight);
      owner.scrollTop = scrollMax;
      return {rows:rows.length,overlapping,scrollMax,scrollTop:owner.scrollTop,
        ownerOverflow:getComputedStyle(owner).overflowY,
        listWidth:document.querySelector('.editor-composition-panel').getBoundingClientRect().width };
    } finally {
      clones.forEach(el => el.remove());
      owner.scrollTop = 0;
    }
  })()`);
  assert(longPage?.rows >= 30 && !longPage.overlapping && longPage.scrollMax > 250
    && longPage.scrollTop > 0 && longPage.ownerOverflow === 'auto'
    && longPage.listWidth >= 220,
    'a wedding invitation with 30+ blocks must scroll without label/action overlap: ' + JSON.stringify(longPage));
  // UX-003/010/011/014/035: mixed 30+ block navigation fixture. DOM-only;
  // no persisted blocks, live account data, or published page are modified.
  for (const width of [900, 1024, 1440, 1672]) {
    await setViewport(client, width, 941, false);
    await evaluate(client, `(() => {
      const list = document.querySelector('.screen-order-v2-list');
      const seed = list?.querySelector('.screen-order-v2-slot');
      if (!seed) return;
      for (let i = 0; i < 30; i++) {
        const clone = seed.cloneNode(true);
        clone.dataset.qaMixedRow = String(i);
        clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        const title = clone.querySelector('.screen-order-v2-identity-copy strong');
        if (title) title.textContent = i % 3 === 0
          ? '이미지 6 · 세로형 웨딩 스냅사진 길어진제목홍길동'
          : i % 3 === 1 ? '코드 7 · wedding-invitation-custom-section' : '텍스트 4 · 찾아오시는 길 안내';
        const icon = clone.querySelector('.screen-order-v2-type-icon');
        if (icon && i % 3 === 0) {
          const image = document.createElement('img');
          image.className = 'screen-order-v2-thumbnail';
          image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="50" height="110"><rect width="50" height="110" fill="#aeb9cb"/></svg>');
          icon.appendChild(image);
          icon.classList.add('has-thumbnail');
        }
        const copy = clone.querySelector('.screen-order-v2-identity-copy');
        let subline = copy?.querySelector('.screen-order-v2-identity-subline');
        if (!subline && copy) {
          subline = document.createElement('span');
          subline.className = 'screen-order-v2-identity-subline';
          copy.appendChild(subline);
        }
        if (subline) {
          subline.replaceChildren();
          const detail = document.createElement('small');
          detail.className = 'screen-order-v2-identity-detail';
          detail.textContent = i % 3 === 0 ? '세로 사진, 타이틀' : '길어진 한글·English 상세 메모';
          subline.appendChild(detail);
          if (i % 4 === 0) {
            clone.querySelector('.screen-order-v2-item')?.classList.add('is-hidden');
            const badge = document.createElement('span');
            badge.className = 'screen-order-v2-hidden-badge';
            badge.textContent = '숨김';
            subline.appendChild(badge);
          }
        }
        list.appendChild(clone);
      }
    })()`);
    const rowQuality = await evaluate(client, `(() => {
      const composition = document.querySelector('.editor-composition-panel');
      const slots = [...composition.querySelectorAll('.screen-order-v2-slot')];
      const rect = el => el?.getBoundingClientRect();
      const intersect = (a,b) => a && b && a.left < b.right - .5 && a.right > b.left + .5 && a.top < b.bottom - .5 && a.bottom > b.top + .5;
      const problems = [];
      let thumbs = 0, hidden = 0;
      slots.forEach((slot, index) => {
        const title = slot.querySelector('.screen-order-v2-identity-copy strong');
        const badge = slot.querySelector('.screen-order-v2-hidden-badge');
        const thumb = slot.querySelector('.screen-order-v2-thumbnail');
        const icon = slot.querySelector('.screen-order-v2-type-icon');
        const head = slot.querySelector('.screen-order-v2-head');
        const actions = [...slot.querySelectorAll('.screen-order-v2-visibility-button,.screen-order-v2-action')];
        if (thumb) { thumbs++; if (rect(icon).width < 26 || rect(icon).height < 26 || getComputedStyle(thumb).objectFit !== 'cover') problems.push('thumbnail-'+index); }
        if (badge) { hidden++; if (getComputedStyle(badge).display === 'none' || getComputedStyle(title).opacity === '0') problems.push('hidden-'+index); }
        if (rect(head).height < 55) problems.push('height-'+index);
        if (actions.some(el => intersect(rect(title), rect(el)) || intersect(rect(badge), rect(el)))) problems.push('actions-'+index);
        if (intersect(rect(title), rect(icon)) || intersect(rect(badge), rect(icon))) problems.push('icon-'+index);
        if (getComputedStyle(title).whiteSpace !== 'nowrap') problems.push('wrap-'+index);
        if (slot.scrollWidth > slot.clientWidth + 1) problems.push('overflow-'+index);
      });
      const fixed = composition.querySelector('.fixed-composition-row .fixed-block-head');
      const regular = composition.querySelector('.screen-order-v2-head');
      const fixedMatches = fixed && regular && Math.abs(rect(fixed).height - rect(regular).height) < 4;
      return {width:composition.clientWidth,rows:slots.length,thumbs,hidden,
        fixedMatches, problems:problems.slice(0,12),totalProblems:problems.length,
        scrollWidth:composition.scrollWidth,clientWidth:composition.clientWidth};
    })()`);
    if (width === 1024 || width === 1672) await capture(client, 'mixed-30-block-navigator-' + width);
    await evaluate(client, `document.querySelectorAll('[data-qa-mixed-row]').forEach(el => el.remove())`);
    assert(rowQuality.rows >= 32 && rowQuality.thumbs >= 10 && rowQuality.hidden >= 7
      && rowQuality.fixedMatches && rowQuality.totalProblems === 0
      && rowQuality.scrollWidth <= rowQuality.clientWidth + 1,
      'mixed 30+ row navigator must not overlap or horizontally overflow at ' + width + ': ' + JSON.stringify(rowQuality));
  }
  await setViewport(client, 1672, 941, false);
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('.text-editor-flow') && document.querySelector('.inspector-navigation')?.querySelectorAll('button').length >= 3`, 'reference text inspector');

  // UX-015: Search locates a block without filtering, renumbering, or changing
  // the order of the user's original page blocks.
  const beforeSearchOrder = await evaluate(client, `[...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map(el => el.id)`);
  await setInputValue(client, 'input[aria-label="블록 이름 검색"]', '텍스트');
  await waitForBrowser(client, `document.querySelector('.editor-search-count')?.textContent.includes('/')`, 'matching blocks are counted');
  await focusSelector(client, 'input[aria-label="블록 이름 검색"]');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`, 'search chooses the matching editor block');
  const afterSearchOrder = await evaluate(client, `[...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map(el => el.id)`);
  assert(JSON.stringify(afterSearchOrder) === JSON.stringify(beforeSearchOrder), 'block search must not reorder or filter any original blocks');
  await setInputValue(client, 'input[aria-label="블록 이름 검색"]', '');

  // UX-006: The selected inspector must allow navigating neighboring blocks
  // without a second scrollbar, and keep the correct mobile selection.
  await waitForBrowser(client, `document.querySelector('.editor-block-switch-position')?.textContent?.includes('/')`,
    'selected inspector shows block index');
  await clickPointer(client, '.editor-block-switch-actions button[aria-label="이전 블록"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-hero')?.dataset.selected === 'true'`,
    'inspector previous selects the hero without a list scroll');
  await clickPointer(client, '.editor-block-switch-actions button[aria-label="다음 블록"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'inspector next returns to the text block');
  assert(apiState.saveCount === 0, 'inspector navigation must not save or publish the page');

  // A 30+ block list must not push the selected Inspector header out of view
  // or add a second Inspector scrollbar (DOM fixture; no page data writes).
  const longInspector = await evaluate(client, `(() => {
    const list = document.querySelector('.screen-order-v2-list');
    const seed = list?.querySelector('.screen-order-v2-slot');
    const scroller = document.querySelector('.work-panel');
    const header = document.querySelector('.screen-order-v2-settings-header');
    const inspector = document.querySelector('.editor-inspector-panel');
    if (!seed || !header || !scroller) return null;
    const clones = [];
    try {
      for (let index = 0; index < 30; index++) {
        const clone = seed.cloneNode(true);
        clone.dataset.qaInspectorClone = String(index);
        clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
        list.appendChild(clone);
        clones.push(clone);
      }
      scroller.scrollTop = Math.min(420, scroller.scrollHeight - scroller.clientHeight);
      const surface = scroller.getBoundingClientRect();
      const title = header.getBoundingClientRect();
      return { scrolled: scroller.scrollTop,
        titleTop: title.top, scrollTop: surface.top,
        inspectorOverflow: getComputedStyle(inspector).overflowY,
        workOverflow: getComputedStyle(scroller).overflowY };
    } finally {
      clones.forEach((clone) => clone.remove());
      scroller.scrollTop = 0;
    }
  })()`);
  assert(longInspector?.scrolled > 250 && Math.abs(longInspector.titleTop - longInspector.scrollTop) < 4
    && longInspector.inspectorOverflow === 'visible' && longInspector.workOverflow === 'auto',
    'long page must keep inspector header pinned with a single shared scrollbar: ' + JSON.stringify(longInspector));
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
  await evaluate(client, `document.querySelector('.work-panel').scrollTop = 0`);

  const geometry = await evaluate(client, `(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,top:r.top,height:r.height}; };
    const stage = document.querySelector('.preview-workspace');
    const list = document.querySelector('.editor-composition-panel');
    const inspector = document.querySelector('.editor-inspector-panel');
    return { header: rect(document.querySelector('.workspace-persistent-header')), list:rect(list), inspector:rect(inspector), stage:rect(stage), phone:rect(document.querySelector('.phone-frame')), pageWidth:document.querySelector('.phone-frame .landing-page').clientWidth,
      phones:stage.querySelectorAll('.phone-frame').length, stageChildren:stage.children.length, widthOptions:stage.querySelectorAll('.preview-width-option').length, documentWidth:document.documentElement.scrollWidth,
      listScroll:getComputedStyle(list).overflowY, inspectorScroll:getComputedStyle(inspector).overflowY,
      labels:[...document.querySelectorAll('.editor-composition-panel .screen-order-v2-identity-copy strong')].map(el => ({
        label: el.textContent, whiteSpace:getComputedStyle(el).whiteSpace, height:el.getBoundingClientRect().height,
        lineHeight:parseFloat(getComputedStyle(el).lineHeight), clipped:el.scrollWidth>el.clientWidth
      })),
      redundantNav:!!document.querySelector('.workspace-persistent-header > .workspace-editor-nav'),
      ancestors:['.builder-shell','.work-panel','.edit-layout'].map(selector => { const el=document.querySelector(selector), css=getComputedStyle(el);return {selector,...rect(el),scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,height:css.height,minHeight:css.minHeight,rows:css.gridTemplateRows,overflow:css.overflowY}; }) };
  })()`);
  console.log('reference geometry:', JSON.stringify(geometry));
  await capture(client, 'desktop-reference-editor-1672');
  assert(Math.abs(geometry.header.height - 64) <= 1 && Math.abs(geometry.list.width - 260) <= 1 && geometry.inspector.width >= 438 && geometry.inspector.width <= 441,
    'reference viewport must have 260px block navigator and 440px property editing: ' + JSON.stringify(geometry));
  assert(Math.abs(geometry.list.top - 64) <= 1 && Math.abs(geometry.inspector.top - 64) <= 1,
    'editing columns must start below the 64px toolbar: ' + JSON.stringify(geometry));
  assert(geometry.ancestors[1].height.endsWith('px') && geometry.ancestors[1].overflow === 'auto'
    && geometry.ancestors[1].scrollHeight > geometry.ancestors[1].height.replace('px','') * 1,
    'only the outer work panel should scroll when selected properties are long: ' + JSON.stringify(geometry));
  assert(geometry.labels.length >= 4 && geometry.labels.every(label => label.whiteSpace === 'nowrap' && label.height <= label.lineHeight + 2),
    'real-page list must keep every Korean block name in a horizontal line: ' + JSON.stringify(geometry.labels));
  assert(geometry.pageWidth === 390 && geometry.phones === 1 && geometry.stageChildren === 1 && geometry.widthOptions === 0
    && geometry.documentWidth <= 1672 && !geometry.redundantNav && geometry.listScroll === 'visible' && geometry.inspectorScroll === 'visible'
    && Math.abs((geometry.stage.left + geometry.stage.right) / 2 - (geometry.phone.left + geometry.phone.right) / 2) <= 4,
    'reference editor must show a balanced right-stage phone and one shared editing scrollbar: ' + JSON.stringify(geometry));

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
  await waitForBrowser(client, `document.querySelector('.work-panel').scrollTop === 0`, 'content navigation returns to shared editor top');

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
