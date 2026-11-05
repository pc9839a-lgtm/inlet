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
    && unselected.editorWidth >= 698 && unselected.listWidth >= 238 && unselected.listWidth <= 241
    && unselected.inspectorWidth >= 458,
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
        const labelStyle = getComputedStyle(title);
        if (labelStyle.whiteSpace !== 'normal' || labelStyle.webkitLineClamp !== '2') problems.push('wrap-'+index);
        if (rect(title).height > parseFloat(labelStyle.lineHeight) * 2 + 3) problems.push('lines-'+index);
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
    // UX-024: four real block inspectors must use the same 44px disclosure
    // header, 12px control rhythm and native keyboard/close behaviour.
    for (const [id, selector] of [
      ['editor-hero', '.hero-editor-design'],
      ['editor-text', '.text-editor-design'],
      ['editor-image', '.image-editor-more'],
      ['editor-form', '.form-design-detail'],
    ]) {
      await clickPointer(client, `#editor-block-${id} .screen-order-v2-head`);
      await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-${id} ${selector} > summary')`,
        'shared design disclosure exists for ' + id);
      const before = await evaluate(client, `(() => {
        const detail = document.querySelector('#editor-block-settings-${id} ${selector}');
        return { open: detail?.open, bodyVisible: !!detail?.querySelector(':scope > .inspector-disclosure-body')?.getClientRects().length };
      })()`);
      await clickPointer(client, `#editor-block-settings-${id} ${selector} > summary`);
      await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} ${selector}')?.open !== ${before.open}`,
        'design disclosure toggles natively for ' + id);
      if (before.open) {
        await clickPointer(client, `#editor-block-settings-${id} ${selector} > summary`);
        await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} ${selector}')?.open === true`,
          'design disclosure restores open state for ' + id);
      }
      const expanded = await evaluate(client, `(() => {
        const detail = document.querySelector('#editor-block-settings-${id} ${selector}');
        const header = detail?.querySelector(':scope > summary');
        const body = detail?.querySelector(':scope > .inspector-disclosure-body');
        const a = header?.getBoundingClientRect(), b = body?.getBoundingClientRect(), d = detail?.getBoundingClientRect();
        const h = header && getComputedStyle(header), c = body && getComputedStyle(body);
        return {
          isNative: detail?.tagName === 'DETAILS', open:detail?.open,
          height:a?.height, labelSize:h?.fontSize, labelWeight:h?.fontWeight,
          gap:c?.gap, paddingTop:c?.paddingTop, paddingBottom:c?.paddingBottom,
          bodyVisible:!!b?.height, overflow:!!b && !!d && (b.right > d.right + 2 || b.left < d.left - 2),
        };
      })()`);
      assert(expanded.isNative && expanded.open && expanded.height >= 44 && expanded.height <= 46
        && expanded.labelSize === '13px' && expanded.labelWeight === '650'
        && expanded.gap === '12px' && expanded.paddingTop === '4px'
        && expanded.paddingBottom === '12px' && expanded.bodyVisible && !expanded.overflow,
        'native design groups should have uniform density at ' + width + ' for ' + id + ': ' + JSON.stringify(expanded));
      if ((width === 900 || width === 1672) && id === 'editor-image')
        await capture(client, 'inspector-group-image-' + width);
      if (!before.open) {
        await clickPointer(client, `#editor-block-settings-${id} ${selector} > summary`);
        await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} ${selector}')?.open === false`,
          'design group recloses for ' + id);
      }
    }
    await clickPointer(client, '#editor-block-editor-hero .screen-order-v2-head');
    const heroImageBefore = await evaluate(client, `(() => {
      const d = document.querySelector('#editor-block-settings-editor-hero .hero-image-adjustments');
      return {open:d?.open, native:d?.classList.contains('inspector-disclosure')};
    })()`);
    assert(heroImageBefore.native, 'hero image effects must share native disclosure component');
    await clickPointer(client, '#editor-block-settings-editor-hero .hero-image-adjustments > summary');
    await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-hero .hero-image-adjustments')?.open !== ${heroImageBefore.open}`,
      'hero image effects native disclosure expands');
    const heroImageState = await evaluate(client, `(() => {
      const d = document.querySelector('#editor-block-settings-editor-hero .hero-image-adjustments');
      const h = d.querySelector('summary').getBoundingClientRect();
      const body = d.querySelector('.hero-image-controls');
      const css = getComputedStyle(body);
      return {height:h.height,gap:css.gap,visible:!!body.getClientRects().length};
    })()`);
    assert(heroImageState.height >= 44 && heroImageState.gap === '12px' && heroImageState.visible,
      'hero image effects must follow disclosure rhythm: ' + JSON.stringify(heroImageState));
    await clickPointer(client, '#editor-block-settings-editor-hero .hero-image-adjustments > summary');
    await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-hero .hero-image-adjustments')?.open === ${heroImageBefore.open}`,
      'hero image disclosure restores original state');
    assert(apiState.saveCount === 0, 'inspector group expand/collapse must never write or publish');
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

  // 14th patch / UX-009: fixed groups can collapse without touching pinned
  // block identities, current inspector selection or the shared scrollbar.
  const fixedGroupsInitial = await evaluate(client, `(() => {
    const top = document.querySelector('[data-fixed-group="top"]');
    const bottom = document.querySelector('[data-fixed-group="bottom"]');
    const button = (root) => root?.querySelector('.editor-fixed-group-toggle');
    return {
      topExpanded: button(top)?.getAttribute('aria-expanded'),
      bottomExpanded: button(bottom)?.getAttribute('aria-expanded'),
      topRows: top?.querySelectorAll('.fixed-composition-row').length,
      bottomRows: bottom?.querySelectorAll('.fixed-composition-row').length,
      buttonCount: document.querySelectorAll('.editor-fixed-group-toggle').length,
    };
  })()`);
  assert(fixedGroupsInitial.topExpanded === 'true' && fixedGroupsInitial.bottomExpanded === 'true'
    && fixedGroupsInitial.topRows === 1 && fixedGroupsInitial.bottomRows === 2
    && fixedGroupsInitial.buttonCount === 2,
    'fixed regions initially expose their real, unreordered rows: ' + JSON.stringify(fixedGroupsInitial));

  await clickPointer(client, '[data-fixed-group="bottom"] .editor-fixed-group-toggle');
  await waitForBrowser(client, `(() => {
    const region = document.querySelector('#editor-fixed-group-bottom');
    const selectedInspector = document.querySelector('#editor-block-settings-editor-bottom');
    const button = document.querySelector('[data-fixed-group="bottom"] .editor-fixed-group-toggle');
    return button?.getAttribute('aria-expanded') === 'false' && !!region && region.hidden
      && !region.getClientRects().length && !!selectedInspector;
  })()`, 'bottom group collapses without clearing its selected inspector');
  await clickPointer(client, '[data-fixed-group="top"] .editor-fixed-group-toggle');
  await waitForBrowser(client, `document.querySelector('#editor-fixed-group-top')?.hidden === true`,
    'top fixed group collapses independently');
  await capture(client, 'fixed-groups-collapsed-1672');

  await clickPointer(client, '[data-fixed-group="top"] .editor-fixed-group-toggle');
  await clickPointer(client, '[data-fixed-group="bottom"] .editor-fixed-group-toggle');
  await waitForBrowser(client, `(() => {
    const top = document.querySelector('#editor-fixed-group-top');
    const bottom = document.querySelector('#editor-fixed-group-bottom');
    return top && !top.hidden && bottom && !bottom.hidden
      && top.querySelectorAll('.fixed-composition-row').length === 1
      && bottom.querySelectorAll('.fixed-composition-row').length === 2;
  })()`, 'both fixed groups restore the original buttons and selectors');
  assert(apiState.saveCount === 0, 'collapsing fixed navigation must not save, publish or reorder the page');

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

  // 15th patch: searching the composition must include fixed navigation rows.
  // Each result selects the real inspector; collapsed groups reopen on search.
  const searchInput = 'input[aria-label="블록 이름 검색"]';
  await setInputValue(client, searchInput, '푸터');
  await waitForBrowser(client, `document.querySelector('.editor-search-count')?.textContent.trim() === '1/1'`,
    'footer is independently searchable');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-footer')?.dataset.selected === 'true'
    && !!document.querySelector('#editor-block-settings-editor-footer')`,
    'search selects footer and its actual inspector');

  await setInputValue(client, searchInput, '');
  await clickPointer(client, '[data-fixed-group="bottom"] .editor-fixed-group-toggle');
  await waitForBrowser(client, `document.querySelector('#editor-fixed-group-bottom')?.hidden === true`,
    'footer group collapses before repeated search');
  await setInputValue(client, searchInput, '푸터');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-fixed-group-bottom')?.hidden === false
    && document.querySelector('#editor-block-editor-footer')?.dataset.selected === 'true'`,
    'search reopens a collapsed group for an already-selected fixed row');

  await setInputValue(client, searchInput, '상단 메뉴');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-topnav')?.dataset.selected === 'true'
    && !!document.querySelector('#editor-block-settings-editor-topnav')`,
    'search locates the fixed top menu');
  await setInputValue(client, searchInput, '하단 고정 버튼');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-bottom')?.dataset.selected === 'true'
    && !!document.querySelector('#editor-block-settings-editor-bottom')`,
    'search locates the bottom CTA rather than the footer');
  const afterFixedSearchOrder = await evaluate(client, `[...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map(el => el.id)`);
  assert(JSON.stringify(afterFixedSearchOrder) === JSON.stringify(beforeSearchOrder),
    'fixed search must not reorder or filter normal page blocks');

  // 17th patch: HTML text is a read-only secondary label for code blocks.
  // The same text must be searchable, without exposing code/CSS source.
  const codeSummary = await evaluate(client, `(() => {
    const row = document.querySelector('#editor-block-editor-code');
    return {
      detail: row?.querySelector('.screen-order-v2-identity-detail')?.textContent || '',
      label: row?.querySelector('.screen-order-v2-identity-copy strong')?.textContent || ''
    };
  })()`);
  assert(codeSummary.label.includes('코드') && codeSummary.detail.includes('초대합니다')
    && codeSummary.detail.includes('초대장 보기')
    && !codeSummary.detail.includes('code-preview-qa'),
    'code rows must expose a readable snippet instead of indistinguishable code numbers: ' + JSON.stringify(codeSummary));
  await setInputValue(client, searchInput, '초대합니다');
  await waitForBrowser(client, `document.querySelector('.editor-search-count')?.textContent.trim() === '1/1'`,
    'HTML text is a valid block search result');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-code')?.dataset.selected === 'true'
    && !!document.querySelector('#editor-block-settings-editor-code')`,
    'code-content search chooses the correct editor without changing code data');

  // 20th patch: combine a type name with content text, then reject a missing
  // second term rather than treating multiple words as an OR search.
  await setInputValue(client, searchInput, '코드 초대합니다');
  await waitForBrowser(client, `document.querySelector('.editor-search-count')?.textContent.trim() === '1/1'`,
    'combined type and HTML snippet matches a single code block');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-code')?.dataset.selected === 'true'`,
    'combined code search selects the same real inspector');
  await setInputValue(client, searchInput, '코드 일치하지않음');
  await waitForBrowser(client, `document.querySelector('.editor-search-count')?.textContent.trim() === '없음'`,
    'combined search requires every term rather than matching code alone');

  // 18th patch: image-only navigator name, separate from public caption.
  await setInputValue(client, searchInput, '');
  await clickPointer(client, '#editor-block-editor-image .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-editor-image input[aria-label="이미지 목록 구분 이름"]')`,
    'image editor offers list-only nickname');
  const originalCaption = await evaluate(client, `document.querySelector('#editor-block-settings-editor-image input[placeholder="이미지 설명을 입력하세요"]')?.value`);
  await setInputValue(client, '#editor-block-settings-editor-image input[aria-label="이미지 목록 구분 이름"]', '본식 사진 QA');
  await waitForBrowser(client, `(() => {
    const row = document.querySelector('#editor-block-editor-image');
    return row?.querySelector('.screen-order-v2-identity-copy strong')?.textContent === '본식 사진 QA'
      && document.querySelector('.screen-order-v2-settings-title > h2')?.textContent === '본식 사진 QA';
  })()`, 'image nickname synchronizes list and inspector');
  await capture(client, 'image-label-editor-1672');
  assert(await evaluate(client, `document.querySelector('#editor-block-settings-editor-image input[placeholder="이미지 설명을 입력하세요"]')?.value`) === originalCaption,
    'image nickname must not overwrite the public caption');
  await setInputValue(client, searchInput, '이미지 본식 사진 QA');
  await waitForBrowser(client, `document.querySelector('.editor-search-count')?.textContent.trim() === '1/1'`,
    'combined image type and custom nickname are searchable');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-image')?.dataset.selected === 'true'`,
    'combined image query keeps the correct selected inspector');
  await setInputValue(client, searchInput, '');
  await setInputValue(client, '#editor-block-settings-editor-image input[aria-label="이미지 목록 구분 이름"]', '');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-image .screen-order-v2-identity-copy strong')?.textContent === '이미지'`,
    'clearing image nickname restores default type title');
  assert(apiState.saveCount === 0, 'image nickname preview must not publish or save');

  await setInputValue(client, searchInput, '텍스트');
  await focusSelector(client, searchInput);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'normal block selection still works after fixed results');
  await setInputValue(client, searchInput, '');
  assert(apiState.saveCount === 0, 'fixed-block search and disclosure changes never save or publish');

  // UX-006/015: Locate the selected React block in a long DOM-only
  // composition, retaining the original page order and one shared scrollbar.
  await waitForBrowser(client, `!!document.querySelector('button[aria-label="선택 블록 위치 찾기"]')`,
    'selected normal block exposes locate control');
  const locateBefore = await evaluate(client, `(() => {
    const list = document.querySelector('.screen-order-v2-list');
    const scroller = document.querySelector('.work-panel');
    const seed = list?.querySelector('.screen-order-v2-slot');
    if (!list || !scroller || !seed) return null;
    for (let i = 0; i < 34; i++) {
      const clone = seed.cloneNode(true);
      clone.dataset.qaLocateClone = String(i);
      clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      list.appendChild(clone);
    }
    scroller.scrollTop = scroller.scrollHeight;
    return { scrollTop: scroller.scrollTop, selected: document.querySelector('#editor-block-editor-text')?.dataset.selected };
  })()`);
  assert(locateBefore?.scrollTop > 250 && locateBefore.selected === 'true',
    'locate fixture must scroll the shared editor: ' + JSON.stringify(locateBefore));
  // The generic pointer helper calls scrollIntoView(), which shifts sticky
  // search navigation while calculating coordinates. Click the already-visible
  // sticky button at its actual viewport position instead.
  const locatePoint = await evaluate(client, `(() => {
    const button = document.querySelector('button[aria-label="선택 블록 위치 찾기"]');
    const rect = button?.getBoundingClientRect();
    if (!rect) return null;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    return { x, y, visible: y > 0 && y < innerHeight,
      hit: document.elementFromPoint(x, y)?.closest('button') === button };
  })()`);
  assert(locatePoint?.visible && locatePoint?.hit,
    'sticky selected locator must be hit-testable at its visible position: ' + JSON.stringify(locatePoint));
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: locatePoint.x, y: locatePoint.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: locatePoint.x, y: locatePoint.y, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: locatePoint.x, y: locatePoint.y, button: 'left', buttons: 0, clickCount: 1 });
  await waitForBrowser(client, `(() => {
    const scroller = document.querySelector('.work-panel');
    const selected = document.querySelector('#editor-block-editor-text');
    const row = selected?.getBoundingClientRect();
    const view = scroller?.getBoundingClientRect();
    const search = document.querySelector('.editor-composition-search')?.getBoundingClientRect();
    return !!row && !!view && !!search && row.top >= search.bottom - 2
      && row.bottom <= view.bottom + 2 && selected.dataset.selected === 'true';
  })()`, 'selected block appears below sticky navigator');
  const locateAfter = await evaluate(client, `(() => {
    const scroller = document.querySelector('.work-panel');
    const selected = document.querySelector('#editor-block-editor-text');
    return { focused: document.activeElement === selected?.querySelector('.screen-order-v2-title-wrap'),
      overflow: getComputedStyle(scroller).overflowY,
      order: [...document.querySelectorAll('.screen-order-v2-list > .screen-order-v2-slot:not([data-qa-locate-clone]) .screen-order-v2-item')].map((element) => element.id) };
  })()`);
  assert(locateAfter.focused && locateAfter.overflow === 'auto'
    && JSON.stringify(locateAfter.order) === JSON.stringify(beforeSearchOrder),
    'selected row must have keyboard focus without changing page order: ' + JSON.stringify(locateAfter));
  await evaluate(client, `(() => {
    document.querySelectorAll('[data-qa-locate-clone]').forEach((element) => element.remove());
    document.querySelector('.work-panel').scrollTop = 0;
  })()`);
  assert(apiState.saveCount === 0, 'locating the selected block must never save or publish');

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

  // 16th patch: a deep composition should keep the selected row visible when
  // switching via inspector previous/next, rather than resetting scrollTop=0.
  // DOM-only clones add depth; React page data and saved block order are untouched.
  const inspectorDepth = await evaluate(client, `(() => {
    const list = document.querySelector('.screen-order-v2-list');
    const image = document.querySelector('#editor-block-editor-image')?.closest('.screen-order-v2-slot');
    const scroller = document.querySelector('.work-panel');
    const seed = list?.querySelector('.screen-order-v2-slot');
    if (!list || !image || !seed || !scroller) return null;
    const addClone = (placement, i) => {
      const node = seed.cloneNode(true);
      node.dataset.qaDeepSwitchClone = String(i);
      node.querySelectorAll('[id]').forEach((item) => item.removeAttribute('id'));
      if (placement === 'before') image.before(node);
      else list.appendChild(node);
    };
    for (let i = 0; i < 26; i++) addClone('before', i);
    for (let i = 26; i < 42; i++) addClone('after', i);
    scroller.scrollTop = 0;
    return { clones: list.querySelectorAll('[data-qa-deep-switch-clone]').length,
      initialScroll: scroller.scrollTop, height: scroller.scrollHeight };
  })()`);
  assert(inspectorDepth?.clones === 42 && inspectorDepth.height > 1200,
    'deep navigation fixture must provide a long scrollable block composition: ' + JSON.stringify(inspectorDepth));
  // Inspector navigation is already verified with native pointer clicks above.
  // A direct button activation here avoids the generic test helper's
  // scrollIntoView() resetting the shared scrollbar before each click.
  // The real fixture order is hero → text → form → code → image.
  // Advance through form and code before checking the deep image position.
  await evaluate(client, `document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]').click()`);
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-form')?.dataset.selected === 'true'`,
    'inspector next moves from text to form');
  await evaluate(client, `document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]').click()`);
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-code')?.dataset.selected === 'true'`,
    'inspector next moves from form to code');
  await evaluate(client, `document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]').click()`);
  await waitForBrowser(client, `(() => {
    const scroller = document.querySelector('.work-panel');
    const row = document.querySelector('#editor-block-editor-image');
    const search = document.querySelector('.editor-composition-search');
    const bounds = row?.getBoundingClientRect();
    return row?.dataset.selected === 'true'
      && !!bounds && bounds.top >= search.getBoundingClientRect().bottom + 4
      && bounds.bottom < scroller.getBoundingClientRect().bottom
      && scroller.scrollTop > 350;
  })()`, 'deep inspector next locates the selected image row without jumping to top');
  const imageScroll = await evaluate(client, `document.querySelector('.work-panel').scrollTop`);
  await evaluate(client, `document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]').click()`);
  await waitForBrowser(client, `(() => {
    const scroller = document.querySelector('.work-panel');
    const row = document.querySelector('#editor-block-editor-bottom');
    const search = document.querySelector('.editor-composition-search');
    const bounds = row?.getBoundingClientRect();
    return row?.dataset.selected === 'true'
      && !!bounds && bounds.top >= search.getBoundingClientRect().bottom - 2
      && bounds.bottom < scroller.getBoundingClientRect().bottom
      && scroller.scrollTop > 350;
  })()`, 'deep inspector next finds the lower fixed CTA instead of losing its list position');
  const bottomScroll = await evaluate(client, `document.querySelector('.work-panel').scrollTop`);
  assert(imageScroll > 350 && bottomScroll > 350, 'deep navigation must never reset to the list start');
  await evaluate(client, `(() => {
    document.querySelectorAll('[data-qa-deep-switch-clone]').forEach((node) => node.remove());
    document.querySelector('.work-panel').scrollTop = 0;
  })()`);
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'deep inspector regression returns to the original text editor');
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
  assert(Math.abs(geometry.header.height - 64) <= 1 && Math.abs(geometry.list.width - 240) <= 1
    && geometry.inspector.width >= 458 && geometry.inspector.width <= 461,
    'reference 1672px viewport must give properties 460px while keeping a compact 240px navigator: ' + JSON.stringify(geometry));
  assert(Math.abs(geometry.list.top - 64) <= 1 && Math.abs(geometry.inspector.top - 64) <= 1,
    'editing columns must start below the 64px toolbar: ' + JSON.stringify(geometry));
  assert(geometry.ancestors[1].height.endsWith('px') && geometry.ancestors[1].overflow === 'auto'
    && geometry.ancestors[1].scrollHeight > geometry.ancestors[1].height.replace('px','') * 1,
    'only the outer work panel should scroll when selected properties are long: ' + JSON.stringify(geometry));
  assert(geometry.labels.length >= 4
    && geometry.labels.every(label => label.whiteSpace === 'normal' && label.height <= label.lineHeight * 2 + 2),
    'long Korean block names must fit within two lines without overlapping actions: ' + JSON.stringify(geometry.labels));
  assert(geometry.pageWidth === 390 && geometry.phones === 1 && geometry.stageChildren === 1 && geometry.widthOptions === 0
    && geometry.documentWidth <= 1672 && !geometry.redundantNav && geometry.listScroll === 'visible' && geometry.inspectorScroll === 'visible'
    && Math.abs((geometry.stage.left + geometry.stage.right) / 2 - (geometry.phone.left + geometry.phone.right) / 2) <= 4,
    'reference editor must show a balanced right-stage phone and one shared editing scrollbar: ' + JSON.stringify(geometry));

  // 21st patch: preview stage is the page itself. No redundant resolution,
  // zoom, fullscreen, or floating block-action toolbars above the phone.
  for (const width of [900, 1024, 1440, 1672]) {
    await setViewport(client, width, 941, false);
    const chrome = await evaluate(client, `(() => {
      const preview = document.querySelector('.preview-workspace');
      const stage = preview.querySelector('.preview-sticky');
      const frame = stage.querySelector('.phone-frame');
      const page = frame.querySelector('.landing-page');
      const box = (el) => el.getBoundingClientRect();
      const css = getComputedStyle(frame);
      return {
        contentWidth: page.clientWidth, frameWidth: box(frame).width,
        frameBorder: css.borderTopWidth, radius: css.borderTopLeftRadius,
        stageCentered: Math.abs((box(stage).left + box(stage).right) / 2 - (box(frame).left + box(frame).right) / 2) <= 4,
        frameInside: box(frame).left >= box(preview).left - 2 && box(frame).right <= box(preview).right + 2,
        children: stage.children.length,
        hasToolbar: !!stage.querySelector('.preview-stage-toolbar,.preview-selection-toolbar,.preview-view-tools,.preview-width-toolbar'),
        selectedBlocks: frame.querySelectorAll('[data-preview-selected="true"]').length,
      };
    })()`);
    const expectedWidth = width <= 950 ? 392 : 394;
    assert(chrome.contentWidth === 390 && Math.abs(chrome.frameWidth - expectedWidth) < 2
      && parseInt(chrome.radius, 10) <= 20 && chrome.stageCentered && chrome.frameInside
      && chrome.children === 1 && !chrome.hasToolbar,
      'mobile editor preview must contain only the 390px phone without auxiliary bars at ' + width + ': ' + JSON.stringify(chrome));
    if (width === 900 || width === 1440) await capture(client, 'clean-phone-stage-' + width);
  }
  await setViewport(client, 1672, 941, false);

  // Selection continues to use the same block ID in the left list and the
  // phone, but edits/visibility/reordering remain in the existing inspector.
  for (const [blockId, selector] of [
    ['editor-hero', '#editor-block-editor-hero .screen-order-v2-head'],
    ['editor-form', '#editor-block-editor-form .screen-order-v2-head'],
    ['editor-bottom', '#editor-block-editor-bottom .fixed-block-head'],
  ]) {
    await clickPointer(client, selector);
    await waitForBrowser(client,
      `!!document.querySelector('#editor-block-${blockId}[data-selected="true"]')`,
      'left navigation retains the selected block ID: ' + blockId);
    const stage = await evaluate(client, `(() => {
      const phone = document.querySelector('.preview-workspace .phone-frame');
      const picked = phone.querySelector('[data-preview-selected="true"]');
      return { width: phone.querySelector('.landing-page')?.clientWidth,
        picked: picked?.id || '', noDock: !document.querySelector('.preview-selection-toolbar') };
    })()`);
    assert(stage.width === 390 && stage.noDock,
      'selected block must not create an action row above the 390px page: ' + JSON.stringify(stage));
  }
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'return to selected text without stage actions');
  assert(apiState.saveCount === 0, 'preview selections never publish or mutate the saved page');

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

  assert(await evaluate(client, `!document.querySelector('.preview-selection-toolbar,.preview-stage-toolbar')`),
    'removed preview chrome must stay absent after editing and selection');

  await setInputValue(client, title, before[0]);
  await focusSelector(client, 'input[aria-label="제목 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="제목 크기 (px)"]', '24');
  await focusSelector(client, 'input[aria-label="본문 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="본문 크기 (px)"]', '15');
  await focusSelector(client, title);
  assert(apiState.saveCount === 0, 'reference editor actions must stay local until explicit publish');
  await setViewport(client, 1280, 900, false);
}
