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
  // UX-020: page alignment has two distinct modes; switching modes is a
  // staged design change, and undo must preserve the real saved page.
  await waitForBrowser(client, `!!document.querySelector('.style-panel-v17 .style-more-groups > .style-advanced-group')`, 'page theme design available');
  await clickPointer(client, '.style-panel-v17 .style-more-groups > .style-advanced-group:first-child > summary');
  await waitForBrowser(client, `!!document.querySelector('.style-panel-v17 button[aria-label="정렬: 블록별"]')`, 'page alignment offers block-by-block option');
  const initialBlockAlignment = await evaluate(client, `document.querySelector('.style-panel-v17 button[aria-label="정렬: 블록별"]')?.getAttribute('aria-pressed') === 'true'`);
  const alignmentChoice = initialBlockAlignment ? '정렬: 가운데' : '정렬: 블록별';
  await clickPointer(client, `.style-panel-v17 button[aria-label="${alignmentChoice}"]`);
  await waitForBrowser(client, `document.querySelector('.style-panel-v17 button[aria-label="${alignmentChoice}"]')?.getAttribute('aria-pressed') === 'true'`, 'page alignment mode selection updates only the staged design');
  // UX-032: page-theme selections and apply/undo use the same compact
  // height, radius, blue selected state and disabled conventions as blocks.
  const pageControlState = await evaluate(client, `(() => {
    const root = document.querySelector('.style-panel-v17');
    const selected = root?.querySelector('.style-segment button[aria-pressed="true"]');
    const apply = root?.querySelector('.style-apply-btn');
    const reset = root?.querySelector('.style-reset-btn');
    const data = (node) => {
      if (!node) return null;
      const s = getComputedStyle(node), b = node.getBoundingClientRect();
      return {height:b.height, radius:s.borderTopLeftRadius, color:s.color, bg:s.backgroundColor, opacity:s.opacity, disabled:node.disabled};
    };
    return {selected:data(selected), apply:data(apply), reset:data(reset), activeLabel:selected?.getAttribute('aria-label')};
  })()`);
  assert(pageControlState?.selected?.height >= 36 && pageControlState.selected.height <= 40
    && parseInt(pageControlState.selected.radius,10) <= 7
    && pageControlState.selected.color === 'rgb(36, 84, 255)'
    && pageControlState.selected.bg === 'rgb(233, 239, 255)'
    && pageControlState.apply.height >= 36 && !pageControlState.apply.disabled
    && !pageControlState.reset.disabled,
    'page controls must show clear selected and enabled state before applying: '+JSON.stringify(pageControlState));
  await capture(client, 'page-theme-alignment-modes');
  await clickPointer(client, '.style-panel-v17 .style-reset-btn');
  await waitForBrowser(client, `document.querySelector('.style-panel-v17 button[aria-label="정렬: 블록별"]')?.getAttribute('aria-pressed') === String(${initialBlockAlignment})`, 'undo restores exact original alignment mode');
  const pageDisabledState = await evaluate(client, `(() => {
    const apply = document.querySelector('.style-panel-v17 .style-apply-btn');
    const reset = document.querySelector('.style-panel-v17 .style-reset-btn');
    return { applyDisabled:apply?.disabled, resetDisabled:reset?.disabled,
      applyOpacity:apply && getComputedStyle(apply).opacity,
      resetOpacity:reset && getComputedStyle(reset).opacity };
  })()`);
  assert(pageDisabledState?.applyDisabled && pageDisabledState?.resetDisabled
    && Number(pageDisabledState.applyOpacity) <= .5 && Number(pageDisabledState.resetOpacity) <= .5,
    'unmodified page design must expose disabled actions, not enabled-looking dead buttons: ' + JSON.stringify(pageDisabledState));
  await capture(client, 'controls-page-disabled-1672');
  assert(apiState.saveCount === 0, 'page alignment mode preview and undo must not write or publish');

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
  // UX-017/024: all primary widget types share one actual inspector hierarchy
  // (not a second row of shortcuts pointing at nested design controls).
  for (const width of [900, 1024, 1440, 1672]) {
    await setViewport(client, width, 941, false);
    for (const [id, designClass, behavior] of [
      ['editor-hero', 'hero-editor-design', false],
      ['editor-text', 'text-editor-design', false],
      ['editor-form', 'form-design-detail', true],
    ]) {
      await clickPointer(client, `#editor-block-${id} .screen-order-v2-head`);
      await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} .inspector-primary-heading')?.textContent?.trim() === '내용'`, 'inspector content heading for ' + id);
      await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} .${designClass} > summary > strong')?.textContent?.trim() === '디자인'`, 'lazy inspector design group for ' + id);
      const hierarchy = await evaluate(client, `(() => {
        const panel = document.querySelector('#editor-block-settings-${id}');
        const design = panel?.querySelector('.${designClass}');
        const label = design?.querySelector(':scope > summary > strong');
        const behavior = panel?.querySelector('.inspector-subgroup-heading');
        const body = panel?.querySelector('.block-editor-v2');
        const box = el => el?.getBoundingClientRect();
        return { hasDuplicate: !!document.querySelector('.inspector-navigation'),
          content: panel?.querySelector('.inspector-primary-heading')?.textContent?.trim(),
          design: label?.textContent?.trim(),
          designOpen: design?.open,
          behavior: behavior?.textContent?.trim() || '',
          groupX: box(design)?.left, groupRight: box(design)?.right,
          inspectorRight: box(panel)?.right,
          innerWidth: box(body)?.width };
      })()`);
      assert(!hierarchy.hasDuplicate && hierarchy.content === '내용' && hierarchy.design === '디자인'
        && (behavior ? hierarchy.behavior === '동작' : !hierarchy.behavior)
        && hierarchy.groupRight <= hierarchy.inspectorRight + 2
        && hierarchy.innerWidth > 210,
        'inspector hierarchy at ' + width + ' for ' + id + ': ' + JSON.stringify(hierarchy));
      // UX-008/018/019/032: browser-resolved editor-only typography tokens,
      // not merely source CSS strings. Test all major inspector block types.
      const uiType = await evaluate(client, `(() => {
        const style = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const css = getComputedStyle(node);
          return { size: css.fontSize, weight: css.fontWeight, color: css.color, gap: css.gap };
        };
        const panel = document.querySelector('#editor-block-settings-${id}');
        const firstLabel = panel?.querySelector('.block-editor-v2 :is(.editor-field-v2-label strong, .field > span, .range > span, .color > span, .choice > span, .toggle > span)');
        const field = firstLabel ? getComputedStyle(firstLabel) : null;
        return {
          listTitle: style('.editor-composition-heading h2'),
          detailTitle: style('.screen-order-v2-settings-title > h2'),
          contentHeading: style('.screen-order-v2-settings .inspector-primary-heading'),
          disclosure: style('.screen-order-v2-settings .inspector-disclosure > summary > strong'),
          normalRow: style('.editor-composition-panel .screen-order-v2-identity-copy strong'),
          fixedRow: style('.fixed-composition-row .screen-order-v2-identity-copy strong'),
          normalDetail: style('.editor-composition-panel .screen-order-v2-identity-detail'),
          label: field && { size: field.fontSize, weight: field.fontWeight, color: field.color },
          editor: style('#editor-block-settings-${id} .block-editor-v2'),
          tokens: Object.fromEntries(['--editor-ui-title-size','--editor-ui-section-size','--editor-ui-label-size','--editor-ui-row-size','--editor-ui-space-4'].map(k=>[k,getComputedStyle(document.querySelector('.edit-layout')).getPropertyValue(k).trim()])),
        };
      })()`);
      assert(uiType.listTitle?.size === '16px' && uiType.listTitle?.weight === '650'
        && uiType.detailTitle?.size === '16px' && uiType.detailTitle?.weight === '650'
        && uiType.contentHeading?.size === '13px' && uiType.contentHeading?.weight === '650'
        && uiType.disclosure?.size === '13px' && uiType.disclosure?.weight === '650'
        && uiType.normalRow?.size === '12px' && uiType.normalRow?.weight === '600'
        && uiType.fixedRow?.size === '12px' && uiType.fixedRow?.weight === '600'
        && uiType.normalDetail?.size === '11px' && uiType.normalDetail?.weight === '500'
        && uiType.label?.size === '13px' && uiType.label?.weight === '600'
        && uiType.editor?.gap === '16px'
        && uiType.tokens['--editor-ui-title-size'] === '16px'
        && uiType.tokens['--editor-ui-space-4'] === '16px'
        && uiType.listTitle.color === uiType.detailTitle.color
        && uiType.normalRow.color === uiType.fixedRow.color,
        'consistent font/spacing contract at ' + width + ' for ' + id + ': ' + JSON.stringify(uiType));
      if ((width === 900 || width === 1672) && id === 'editor-form') await capture(client, 'unified-editor-type-' + width);
    }
    if (width === 1024 || width === 1672) await capture(client, 'single-hierarchy-form-' + width);
  }
  for (const width of [900, 1440]) {
    await setViewport(client, width, 941, false);
    await clickPointer(client, '.editor-page-settings-button');
    await waitForBrowser(client, `!!document.querySelector('.editor-page-options-stack .style-panel-v17')`, 'unified design inspector is mounted');
    const pageType = await evaluate(client, `(() => {
      const css = selector => {
        const e = document.querySelector(selector);
        if (!e) return null;
        const c = getComputedStyle(e);
        return { size: c.fontSize, weight: c.fontWeight, color: c.color, gap: c.gap };
      };
      return {
        status: css('.style-panel-v17 .style-apply-bar strong'),
        heading: css('.style-panel-v17 .style-background-group h3'),
        label: css('.style-panel-v17 .style-line > span'),
        panel: css('.style-panel-v17'),
        group: css('.style-panel-v17 .style-primary-group'),
      };
    })()`);
    assert(pageType.status?.size === '14px' && pageType.status?.weight === '650'
      && pageType.heading?.size === '13px' && pageType.heading?.weight === '650'
      && pageType.label?.size === '12px' && pageType.label?.weight === '600'
      && pageType.panel?.gap === '16px' && pageType.group?.gap === '12px',
      'page-level design inspector matches editor type and spacing at ' + width + ': ' + JSON.stringify(pageType));
    await capture(client, 'unified-page-design-type-' + width);
  }
  await setViewport(client, 1672, 941, false);
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('.text-editor-flow') && !!document.querySelector('.inspector-primary-heading') && !document.querySelector('.inspector-navigation')`, 'reference single-hierarchy text inspector');

  // UX-032: 42px native fields / 36px compact fields / 44px toggle hit area.
  // Check computed styles at compact and wide inspector widths. Keep model
  // values unchanged; disabled states below are DOM-only and immediately reset.
  for (const width of [900, 1024, 1440, 1672]) {
    await setViewport(client, width, 941, false);
    const metrics = await evaluate(client, `(() => {
      const scope = document.querySelector('#editor-block-settings-editor-text');
      const details = scope?.querySelector('.text-editor-flow');
      if (!details) return null;
      const input = details.querySelector('.editor-field-v2 textarea');
      const segment = details.querySelector('.editor-segmented-v2-options button[aria-pressed="true"]');
      const rail = segment?.parentElement;
      const number = details.querySelector('.editor-number-value > input');
      const numberBox = details.querySelector('.editor-number-value');
      const steppers = details.querySelector('.editor-number-steppers');
      const hex = details.querySelector('.color-clean input[type="text"]');
      const swatch = details.querySelector('.color-clean input[type="color"]');
      const eyedropper = details.querySelector('.color-clean .eyedropper');
      const colorRow = details.querySelector('.color-clean .color-main');
      const measure = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
        return {height:rect.height, left:rect.left, right:rect.right, radius:css.borderTopLeftRadius,
          color:css.color, bg:css.backgroundColor, outline:css.outlineWidth};
      };
      const oldDisabled = segment?.disabled;
      if (segment) segment.disabled = true;
      const disabledOpacity = segment ? getComputedStyle(segment).opacity : null;
      if (segment) segment.disabled = oldDisabled;
      return {
        input:measure(input), segment:measure(segment), rail:measure(rail),
        number:measure(number), numberBox:measure(numberBox), steppers:measure(steppers),
        hex:measure(hex), swatch:measure(swatch), eyedropper:measure(eyedropper),
        colorRow:measure(colorRow), disabledOpacity,
        overflow:colorRow ? colorRow.scrollWidth > colorRow.clientWidth + 1 : true,
        cssToken:getComputedStyle(document.querySelector('.edit-layout')).getPropertyValue('--editor-ui-control-radius').trim(),
      };
    })()`);
    assert(metrics?.input?.height >= 78
      && metrics.segment?.height >= 36 && metrics.segment.height <= 44
      && metrics.segment.color === 'rgb(36, 84, 255)'
      && metrics.segment.bg === 'rgb(233, 239, 255)'
      && metrics.rail?.height >= 40 && parseInt(metrics.rail.radius,10) <= 7
      && metrics.number?.height >= 36 && metrics.number.height <= 44
      && metrics.hex?.height >= 36 && metrics.hex.height <= 44
      && metrics.swatch?.height >= 36 && metrics.eyedropper?.height >= 36
      && metrics.numberBox?.radius === '7px' && metrics.hex.radius === '7px'
      && Number(metrics.disabledOpacity) <= .5 && !metrics.overflow
      && metrics.swatch.right <= metrics.hex.left
      && metrics.hex.right <= metrics.eyedropper.left
      && metrics.cssToken === '7px',
      'block fields/selection/number/HEX must align at ' + width + ': ' + JSON.stringify(metrics));
    if (width === 900 || width === 1440) await capture(client, 'control-states-block-' + width);
  }
  await setViewport(client, 1672, 941, false);
  await focusSelector(client, '#editor-block-settings-editor-text .color-clean input[type="text"]');
  const focusRing = await evaluate(client, `(() => {
    const element = document.querySelector('#editor-block-settings-editor-text .color-clean input[type="text"]');
    return { focused:document.activeElement === element,
      width:element && getComputedStyle(element).outlineWidth,
      style:element && getComputedStyle(element).outlineStyle };
  })()`);
  assert(focusRing.focused && focusRing.width === '2px' && focusRing.style === 'solid',
    'keyboard focus must be visible on HEX input: ' + JSON.stringify(focusRing));

  await clickPointer(client, '#editor-block-editor-bottom .fixed-block-head');
  await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-editor-bottom .bottom-bar-editor-design > summary')`,
    'bottom fixed CTA exposes real design controls');
  await clickPointer(client, '#editor-block-settings-editor-bottom .bottom-bar-editor-design > summary');
  await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-editor-bottom .editor-toggle-row-v2 button[role="switch"]')`,
    'bottom CTA shows semantic on/off control');
  const switchMetrics = await evaluate(client, `(() => {
    const node = document.querySelector('#editor-block-settings-editor-bottom .editor-toggle-row-v2 button[role="switch"]');
    const original = node.getAttribute('aria-checked'), initialDisabled=node.disabled;
    const rect = node.getBoundingClientRect();
    node.setAttribute('aria-checked','false');
    const off = getComputedStyle(node,'::before').backgroundColor;
    node.setAttribute('aria-checked','true');
    const on = getComputedStyle(node,'::before').backgroundColor;
    node.disabled = true;
    const disabledOpacity = getComputedStyle(node).opacity;
    node.disabled = initialDisabled;
    node.setAttribute('aria-checked', original);
    return { width:rect.width,height:rect.height,off,on,disabledOpacity,restored:node.getAttribute('aria-checked')===original };
  })()`);
  assert(switchMetrics.width === 46 && switchMetrics.height >= 44
    && switchMetrics.off === 'rgb(208, 213, 221)'
    && switchMetrics.on === 'rgb(36, 84, 255)'
    && Number(switchMetrics.disabledOpacity) <= .5 && switchMetrics.restored,
    'switch must retain 44px target, clear off/on color and disabled appearance: ' + JSON.stringify(switchMetrics));
  await capture(client, 'control-states-bottom-toggle');
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-editor-text .text-editor-flow')`,
    'control QA returns to original text editor without draft or public save');
  assert(apiState.saveCount === 0, 'control styling, temporary disabled attributes and navigation must never publish');

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
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .editor-theme-source-state')?.dataset.styleSource === 'block'`, 'text color displays explicit saved color source');
  await clickPointer(client, 'button[aria-label="글자색 전체 디자인으로 되돌리기"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .editor-theme-source-state')?.dataset.styleSource === 'page'
    && !document.querySelector('.phone-frame #block-editor-text')?.hasAttribute('data-custom-text-color')`,
    'reset only removes this text color override from preview');
  await waitForBrowser(client, `getComputedStyle(document.querySelector('.phone-frame #block-editor-text h2')).color
    === getComputedStyle(document.querySelector('.phone-frame .landing-page')).color`,
    'text without override follows page-wide text color');
  await capture(client, 'text-color-inheritance-reset');
  assert(apiState.saveCount === 0, 'text color source/reset must remain in the unpublished editor draft');
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

  // UX-027/030: 390px public-layout parity with a light, low-noise frame
  // and a single compact toolbar. Check normal/narrow desktop widths without
  // modifying the page or using a separate fake preview.
  for (const width of [900, 1024, 1440, 1672]) {
    await setViewport(client, width, 941, false);
    const chrome = await evaluate(client, `(() => {
      const preview = document.querySelector('.preview-workspace');
      const stage = preview.querySelector('.preview-sticky');
      const toolbar = preview.querySelector('.preview-stage-toolbar');
      const label = preview.querySelector('.preview-width-toolbar');
      const controls = preview.querySelector('.preview-view-tools');
      const select = controls.querySelector('select[aria-label="미리보기 배율"]');
      const full = controls.querySelector('button[aria-label="미리보기 전체 화면"]');
      const frame = preview.querySelector('.phone-frame');
      const page = frame.querySelector('.landing-page');
      const box = (el) => el.getBoundingClientRect();
      const css = getComputedStyle(frame);
      const outer = box(frame), top = box(toolbar), left = box(label), right = box(controls);
      const buttons = [select, full].map(box);
      return {
        contentWidth: page.clientWidth, frameWidth: outer.width, frameBorder: css.borderTopWidth,
        frameRadius: css.borderTopLeftRadius, frameShadow: css.boxShadow,
        stageBackground: getComputedStyle(preview).backgroundColor,
        labelBackground: getComputedStyle(label).backgroundColor,
        labelText: label.textContent.trim(), labelSize: getComputedStyle(label).fontSize,
        toolbarHeight: top.height, toolbarBottom: top.bottom, frameTop: outer.top,
        controlsInside: buttons.every(b => b.left >= right.left - 2 && b.right <= right.right + 2),
        toolbarSeparated: left.right <= right.left + 3,
        stageCentered: Math.abs((box(stage).left + box(stage).right) / 2 - (outer.left + outer.right) / 2) <= 4,
        zoomOptions: [...select.options].map(o => Number(o.value)), fullscreenLabel: full.getAttribute('aria-label'),
        frameInsideStage: outer.left >= box(preview).left - 2 && outer.right <= box(preview).right + 2,
      };
    })()`);
    const expectedWidth = width <= 950 ? 392 : 394;
    const expectedBorder = width <= 950 ? '1px' : '2px';
    assert(chrome.contentWidth === 390 && Math.abs(chrome.frameWidth - expectedWidth) < 2
      && chrome.frameBorder === expectedBorder && parseInt(chrome.frameRadius, 10) <= 20
      && chrome.labelBackground === 'rgba(0, 0, 0, 0)'
      && chrome.labelSize === '12px' && chrome.labelText.includes('390px')
      && chrome.toolbarHeight <= 38 && chrome.controlsInside && chrome.toolbarSeparated
      && chrome.stageCentered && chrome.frameInsideStage
      && chrome.zoomOptions.join(',') === '75,100,125'
      && chrome.fullscreenLabel === '미리보기 전체 화면',
      'preview frame and compact toolbar must retain accurate dimensions at ' + width + ': ' + JSON.stringify(chrome));
    if (width === 900 || width === 1440) await capture(client, 'light-preview-frame-' + width);
  }
  await setViewport(client, 1672, 941, false);

  // Zoom changes only the viewing scale; the page's layout width stays 390px.
  await evaluate(client, `(() => { const el = document.querySelector('select[aria-label="미리보기 배율"]'); el.value='75'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitForBrowser(client, `document.querySelector('.phone-frame').getBoundingClientRect().width < 310 && document.querySelector('.phone-frame .landing-page').clientWidth === 390`, 'preview zoom scales the view without changing page layout');
  await evaluate(client, `(() => { const el = document.querySelector('select[aria-label="미리보기 배율"]'); el.value='100'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitForBrowser(client, `document.querySelector('.phone-frame').getBoundingClientRect().width >= 392`, 'preview zoom reset');

  // UX-025/026/029: an editor action dock belongs to the stage ABOVE the
  // phone. It must not cover any headline, form input, submit or fixed CTA at
  // 75/100/125% regardless of which block is selected.
  for (const scale of [75, 100, 125]) {
    await evaluate(client, `(() => {
      const select = document.querySelector('select[aria-label="미리보기 배율"]');
      select.value = '${scale}';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitForBrowser(client,
      `Math.abs(document.querySelector('.phone-frame').getBoundingClientRect().width - 394 * ${scale}/100) <= 3
        && document.querySelector('.phone-frame .landing-page').clientWidth === 390`,
      'preview keeps logical 390px canvas at ' + scale + '%');
    for (const [blockId, selector] of [
      ['editor-hero', '#editor-block-editor-hero .screen-order-v2-head'],
      ['editor-form', '#editor-block-editor-form .screen-order-v2-head'],
      ['editor-bottom', '#editor-block-editor-bottom .fixed-block-head'],
    ]) {
      await clickPointer(client, selector);
      await waitForBrowser(client, `document.querySelector('.preview-selection-toolbar')?.dataset.selectedBlockId === '${blockId}'`,
        'stage dock follows selected block ' + blockId);
      const separation = await evaluate(client, `(() => {
        const dock = document.querySelector('.preview-selection-toolbar');
        const stage = document.querySelector('.preview-sticky');
        const phone = document.querySelector('.phone-frame');
        const landing = phone?.querySelector('.landing-page');
        const rect = e => e?.getBoundingClientRect();
        const area = rect(dock), frame = rect(phone), parent = rect(stage);
        const controls = [...dock.querySelectorAll('button')];
        const text = dock.querySelector('.preview-selection-identity strong');
        const overlapping = controls.some(el => {
          const b = rect(el);
          return b.right > area.right + .75 || b.left < area.left - .75 || b.top < area.top - .75 || b.bottom > area.bottom + .75;
        });
        return {
          position: getComputedStyle(dock).position,
          dockBottom: area.bottom, phoneTop: frame.top,
          dockLeft: area.left, dockRight: area.right, stageLeft: parent.left, stageRight: parent.right,
          phoneWidth: frame.width, logicalWidth: landing.clientWidth,
          visibleTitle: !!text && rect(text).width >= 22,
          controls: controls.length, hasOverflow: dock.scrollWidth > dock.clientWidth + 1,
          overlapping, hidden: dock.dataset.previewHidden,
          selection: dock.dataset.selectedBlockId,
          canvasSelection: document.querySelector('.screen-order-v2-item[data-selected="true"],.fixed-composition-row[data-selected="true"]')?.id || '',
        };
      })()`);
      assert(separation.position !== 'absolute' && separation.dockBottom + 1 <= separation.phoneTop
        && separation.dockLeft >= separation.stageLeft - 2 && separation.dockRight <= separation.stageRight + 2
        && separation.logicalWidth === 390 && separation.visibleTitle
        && separation.controls >= 1 && !separation.hasOverflow && !separation.overlapping
        && separation.hidden === 'false' && separation.selection === blockId
        && separation.canvasSelection === 'editor-block-' + blockId,
        'selected stage dock cannot obscure the phone at ' + scale + '% ' + blockId + ': ' + JSON.stringify(separation));
      if ((scale === 75 && blockId === 'editor-hero') || (scale === 100 && blockId === 'editor-form') || (scale === 125 && blockId === 'editor-bottom')) {
        await capture(client, 'stage-selection-' + scale + '-' + blockId);
      }
    }
  }
  await clickPointer(client, '.preview-selection-toolbar button[aria-label="블록 숨기기"]');
  await waitForBrowser(client,
    `document.querySelector('.preview-selection-toolbar')?.dataset.previewHidden === 'true'
       && !!document.querySelector('.preview-selection-toolbar button[aria-label="블록 표시"]')`,
    'hidden fixed CTA still has a visible restore action outside the phone');
  await capture(client, 'stage-selection-hidden-fixed-cta');
  await clickPointer(client, '.preview-selection-toolbar button[aria-label="블록 표시"]');
  await waitForBrowser(client,
    `document.querySelector('.preview-selection-toolbar')?.dataset.previewHidden === 'false'
       && !!document.querySelector('.preview-selection-toolbar button[aria-label="블록 숨기기"]')`,
    'fixed CTA restored without editor page reload');
  assert(apiState.saveCount === 0, 'selection, zoom and show/hide QA must never publish a page');
  await evaluate(client, `(() => {
    const select = document.querySelector('select[aria-label="미리보기 배율"]');
    select.value = '100'; select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('.preview-selection-toolbar')?.dataset.selectedBlockId === 'editor-text'`,
    'return to reference selected text before remaining editor regression');

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
  await clickPointer(client, '#editor-block-settings-editor-text .block-editor-advanced-settings > summary');
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .block-editor-advanced-settings').open`, 'single advanced group opens the anchor control');
  await evaluate(client, `document.querySelector('.work-panel').scrollTop = 0`);
  await waitForBrowser(client, `document.querySelector('.work-panel').scrollTop === 0`, 'shared editor scroll remains available without a second group navigator');

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
