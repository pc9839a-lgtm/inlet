// The owner reference defines the chrome. Content below is a disposable QA page.
export async function checkReferenceEditor({ client, evaluate, assert, waitForBrowser, clickPointer, setInputValue, focusSelector, pressKeyboardKey, capture, setViewport, apiState }) {
  const setEditorViewport = async (width) => {
    await setViewport(client, width, 941, false);
    if (width >= 900 && width < 1280) await evaluate(client, `(() => {
      const trigger = document.querySelector('.editor-navigator-drawer-trigger');
      if (trigger?.getAttribute('aria-expanded') !== 'true') trigger?.click();
    })()`);
    if (width >= 900 && width < 1280) await waitForBrowser(client,
      `document.querySelector('.editor-composition-panel')?.getBoundingClientRect().left >= -1`,
      'laptop navigator drawer fully opened before selecting a row');
  };
  // The laptop navigator overlays the LEFT inspector. Open the drawer for
  // block-list actions, but close it before clicking real inspector controls.
  const clickNavigatorRow = async (selector) => {
    const inspectorTarget = selector.startsWith('#editor-block-settings-');
    await evaluate(client, `(() => {
      const trigger = document.querySelector('.editor-navigator-drawer-trigger');
      if (innerWidth < 900 || innerWidth >= 1280 || !trigger) return;
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      if (${inspectorTarget} ? isOpen : !isOpen) trigger.click();
    })()`);
    await waitForBrowser(client,
      inspectorTarget
        ? `innerWidth >= 1280 || document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'false'`
        : `innerWidth >= 1280 || document.querySelector('.editor-composition-panel')?.getBoundingClientRect().left >= -1`,
      inspectorTarget ? 'left inspector unobstructed by laptop drawer'
        : 'laptop drawer fully visible and hit-testable before selecting its next row');
    await clickPointer(client, selector);
  };
  // A fresh editor opens on the real page, not a permanently open settings
  // column. The selected block and full 390px live page survive mode switches.
  await setViewport(client, 1672, 941, false);
  await evaluate(client, `document.querySelector('.edit-layout')?.dataset.inspectorOpen === 'true'
    && document.querySelector('.editor-workbench-close-inspector')?.click()`);
  assert(await evaluate(client, `!document.querySelector('.editor-workbench-section-switch')`),
    'persistent block list must not waste space on a redundant page/edit mode switch');
  await waitForBrowser(client, `(() => {
    const layout = document.querySelector('.edit-layout');
    const stage = document.querySelector('.preview-workspace');
    const list = document.querySelector('.editor-composition-panel');
    const inspector = document.querySelector('.editor-properties-panel');
    const phone = stage?.querySelector('.landing-page');
    return layout?.dataset.inspectorOpen === 'false'
      && getComputedStyle(inspector).display === 'none'
      && getComputedStyle(document.querySelector('.builder-shell')).gridTemplateColumns.split(' ').length === 2
      && stage.getBoundingClientRect().left >= list.getBoundingClientRect().right - 2
      && phone?.clientWidth === 390
      && stage.querySelector('.phone-frame')?.getBoundingClientRect().left >= list.getBoundingClientRect().right
      && Math.abs(window.innerWidth - stage.querySelector('.phone-frame').getBoundingClientRect().right - 28) <= 3;
  })()`, 'desktop first screen prioritizes actual 390px page without a permanent inspector');
  const pinnedPhoneLeft = await evaluate(client,
    `document.querySelector('.phone-frame')?.getBoundingClientRect().left`);
  await capture(client, 'workbench-page-first-1672');
  await clickPointer(client, '.editor-composition-panel .screen-order-v2-item[data-selected="true"] .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inlineEditing === 'true'
    && document.querySelectorAll('#editor-selection-panel').length === 1
    && document.querySelector('.editor-composition-content .editor-inline-expanded .screen-order-v2-settings')
      ?.getBoundingClientRect().width >= 440
    && getComputedStyle(document.querySelector('.editor-properties-panel')).display === 'none'
    && Math.abs(document.querySelector('.phone-frame')?.getBoundingClientRect().left - ${pinnedPhoneLeft}) <= 2`,
    'selecting a block must expand exactly one real editor below its row, beside fixed preview');
  await capture(client, 'littly-inline-block-edit-1672');
  await clickPointer(client, '.editor-inline-expanded-heading button');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inspectorOpen === 'false'
    && document.activeElement === document.querySelector('.editor-composition-panel')
    && document.querySelector('.preview-workspace .landing-page')?.clientWidth === 390
    && Math.abs(document.querySelector('.phone-frame')?.getBoundingClientRect().left - ${pinnedPhoneLeft}) <= 2`,
    'closing an Inspector must preserve the live preview X-coordinate and visible focus');
  await clickPointer(client, '.editor-composition-panel .screen-order-v2-item[data-selected="true"] .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inlineEditing === 'true'`,
    'selected row reopens its existing inline editor');
  await focusSelector(client, '.editor-inline-expanded-heading button');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inspectorOpen === 'false'
    && document.activeElement === document.querySelector('.editor-composition-heading h2')`,
    'keyboard return keeps a visible focus target');
  await clickPointer(client, '.editor-composition-panel .screen-order-v2-item[data-selected="true"] .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inlineEditing === 'true'`,
    'keyboard return does not break subsequent row edit');
  // Visual reference: a named, full-width add action and readable flat
  // composition rows at both the chosen 1672px size and narrow 900px PC.
  for (const referenceWidth of [1672, 900]) {
    await setEditorViewport(referenceWidth);
    const visual = await evaluate(client, `(() => {
      const heading = document.querySelector('.editor-composition-heading');
      const button = heading?.querySelector('.add-dock-compact .add-toggle');
      const label = button?.querySelector('strong');
      const search = document.querySelector('.editor-composition-search');
      const row = document.querySelector('.editor-composition-panel .screen-order-v2-identity-copy strong');
      const fixedRow = document.querySelector('.fixed-composition-row .screen-order-v2-identity-copy strong');
      const frame = document.querySelector('.phone-frame .landing-page');
      if (!heading || !button || !label || !search || !row || !fixedRow || !frame) return null;
      const rect = (node) => node.getBoundingClientRect();
      return {
        heading: heading.querySelector('h2')?.textContent.trim(),
        kicker: heading.querySelector('.editor-panel-kicker')?.textContent.trim(),
        total: heading.querySelector('.editor-composition-total')?.textContent.trim(),
        buttonText: label.textContent.trim(),
        ariaLabel: button.getAttribute('aria-label'),
        buttonWidth: rect(button).width,
        buttonHeight: rect(button).height,
        headingWidth: rect(heading).width,
        buttonBackground: getComputedStyle(button).backgroundColor,
        labelVisible: rect(label).width > 50 && rect(label).height > 10,
        searchBelowButton: rect(search).top >= rect(button).bottom,
        listNameSize: getComputedStyle(row).fontSize,
        fixedNameSize: getComputedStyle(fixedRow).fontSize,
        normalRowHeight: rect(row.closest('.screen-order-v2-head')).height,
        fixedRowHeight: rect(fixedRow.closest('.fixed-block-head')).height,
        compositionWidth: rect(document.querySelector('.editor-composition-panel')).width,
        inspectorWidth: rect(document.querySelector('.editor-properties-panel')).width,
        compositionBackground: getComputedStyle(document.querySelector('.editor-composition-panel')).backgroundColor,
        inspectorBackground: getComputedStyle(document.querySelector('.editor-properties-panel')).backgroundColor,
        stageBackground: getComputedStyle(document.querySelector('.preview-workspace')).backgroundColor,
        stageHeading: document.querySelector('.preview-stage-label strong')?.textContent.trim(),
        stageWidth: document.querySelector('.preview-stage-width')?.textContent.trim(),
        phoneWidth: frame.clientWidth,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    })()`);
    const expectedComposerWidth = referenceWidth < 1280 ? 264 : 560;
    assert(visual?.heading?.startsWith('블록 편집') && visual.kicker === '페이지 구성'
      && /[0-9]+개 블록/.test(visual.total) && visual.buttonText === '블록 추가'
      && visual.ariaLabel === '블록 추가' && visual.labelVisible
      && visual.buttonWidth >= visual.headingWidth - 48
      && visual.buttonHeight >= 42 && visual.buttonHeight <= 46
      && visual.searchBelowButton && visual.buttonBackground === 'rgb(23, 89, 238)'
      && visual.listNameSize === '13px' && visual.fixedNameSize === '13px'
      && visual.normalRowHeight >= 54 && Math.abs(visual.normalRowHeight - visual.fixedRowHeight) <= 4
      && Math.abs(visual.compositionWidth - expectedComposerWidth) <= 3
      && Math.abs(visual.inspectorWidth - (referenceWidth < 1280 ? 334 : 0)) <= 3
      && visual.compositionBackground === 'rgb(248, 250, 255)'
      && visual.inspectorBackground === 'rgb(255, 255, 255)'
      && visual.stageBackground === (referenceWidth < 1280 ? 'rgb(238, 242, 247)' : 'rgb(233, 238, 246)')
      && visual.stageHeading === '실제 페이지' && visual.stageWidth === '모바일 390px'
      && visual.phoneWidth === 390 && visual.overflow <= 3,
      'littly desktop must combine block rows with their original inline editor: '
      + JSON.stringify({ referenceWidth, visual }));
    await capture(client, 'editor-visual-hierarchy-' + referenceWidth);
  }
  // On the 900px laptop drawer, Escape clears a search before it dismisses
  // the drawer. Clearing a query must preserve the user's navigator context.
  const laptopSearchInput = 'input[aria-label="블록 이름 검색"]';
  await setInputValue(client, laptopSearchInput, '텍스트');
  await waitForBrowser(client,
    `document.querySelector('.editor-search-count')?.textContent.includes('/')`,
    'laptop search provides an active result counter');
  await focusSelector(client, laptopSearchInput);
  // On laptops, an unflagged Escape during a Korean IME composition used to
  // bubble from the search input and close the *parent* drawer, even though
  // the input itself correctly left the search query untouched.
  const laptopImeEscape = await evaluate(client, `(() => {
    const input = document.querySelector('input[aria-label="블록 이름 검색"]');
    input.dispatchEvent(new CompositionEvent('compositionstart',
      { bubbles: true, data: '텍' }));
    const plain = new KeyboardEvent('keydown',
      { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    const flagged = new KeyboardEvent('keydown',
      { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true, cancelable: true });
    input.dispatchEvent(plain);
    input.dispatchEvent(flagged);
    input.dispatchEvent(new CompositionEvent('compositionend',
      { bubbles: true, data: '텍스트' }));
    return { plainPrevented: plain.defaultPrevented, flaggedPrevented: flagged.defaultPrevented };
  })()`);
  await waitForBrowser(client,
    `document.querySelector('.editor-composition-search input')?.value === '텍스트'
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('.editor-composition-search input')`,
    'Korean IME Escape cancels composition without closing the laptop block drawer or clearing search');
  assert(!laptopImeEscape.plainPrevented && !laptopImeEscape.flaggedPrevented,
    'composing Escape must remain available to the Korean IME: ' + JSON.stringify(laptopImeEscape));
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client,
    `document.querySelector('.editor-composition-search input')?.value === ''
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('.editor-composition-search input')`,
    'first Escape clears block search while keeping the laptop list open and input focused');
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'false'
      && document.activeElement === document.querySelector('.editor-navigator-drawer-trigger')`,
    'second Escape closes the laptop block list and restores trigger focus');
  // Outside pointer activation dismisses the laptop drawer, but must not
  // prevent the actual canvas/inspector action or leave focus in hidden rows.
  await clickPointer(client, '.editor-navigator-drawer-trigger');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'`,
    'laptop drawer opens for outside-click dismissal checks');
  await clickPointer(client, 'input[aria-label="블록 이름 검색"]');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'`,
    'interacting inside the block drawer does not dismiss it');
  // The add-block dialog is also portaled to body. A gallery interaction must
  // not hide its originating laptop drawer: closing the dialog restores focus
  // to the original add button, which must remain visible and operable.
  await clickPointer(client, '.editor-composition-heading .add-toggle');
  await waitForBrowser(client,
    `!!document.querySelector('.editor-gallery-dialog')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'`,
    'laptop add-block gallery opens without closing its originating drawer');
  const gallerySearch = 'input[aria-label="추가할 블록 검색"]';
  await setInputValue(client, gallerySearch, '문의');
  await focusSelector(client, gallerySearch);
  const galleryImeEscape = await evaluate(client, `(() => {
    const input = document.querySelector('input[aria-label="추가할 블록 검색"]');
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '문' }));
    const plain = new KeyboardEvent('keydown',
      { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    const flagged = new KeyboardEvent('keydown',
      { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true, cancelable: true });
    input.dispatchEvent(plain);
    input.dispatchEvent(flagged);
    const remainedOpen = !!document.querySelector('.editor-gallery-dialog');
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '문의' }));
    return { plainPrevented: plain.defaultPrevented,
      flaggedPrevented: flagged.defaultPrevented, remainedOpen };
  })()`);
  await waitForBrowser(client,
    `document.querySelector('input[aria-label="추가할 블록 검색"]')?.value === '문의'
      && !!document.querySelector('.editor-gallery-dialog')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('input[aria-label="추가할 블록 검색"]')`,
    'Korean IME Escape keeps gallery search, dialog, laptop drawer and keyboard focus intact')
    .catch(async (error) => {
      const state = await evaluate(client, `(() => ({
        inputValue: document.querySelector('input[aria-label="추가할 블록 검색"]')?.value ?? null,
        galleryOpen: !!document.querySelector('.editor-gallery-dialog'),
        drawerExpanded: document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded'),
        activeElement: document.activeElement?.outerHTML?.slice(0, 280) ?? null,
      }))()`);
      throw new Error(error.message + ' ' + JSON.stringify({ state, galleryImeEscape }));
    });
  assert(galleryImeEscape.remainedOpen && !galleryImeEscape.plainPrevented && !galleryImeEscape.flaggedPrevented,
    'IME Escape must reach composition without dismissing gallery: ' + JSON.stringify(galleryImeEscape));
  await clickPointer(client, '.editor-gallery-dialog-head h2');
  await waitForBrowser(client,
    `!!document.querySelector('.editor-gallery-dialog')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'`,
    'pointer interactions inside portaled gallery preserve laptop drawer');
  await clickPointer(client, '.editor-gallery-close');
  await waitForBrowser(client,
    `!document.querySelector('.editor-gallery-dialog')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('.editor-composition-heading .add-toggle')
      && !!document.activeElement.getClientRects().length`,
    'closing laptop gallery restores focus to visible block-add button');
  await clickPointer(client, '.editor-composition-heading .add-toggle');
  await waitForBrowser(client, `!!document.querySelector('.editor-gallery-dialog')`,
    'laptop gallery can reopen for ordinary Escape closing');
  await focusSelector(client, 'input[aria-label="추가할 블록 검색"]');
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client,
    `!document.querySelector('.editor-gallery-dialog')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('.editor-composition-heading .add-toggle')`,
    'ordinary Escape closes only gallery while preserving laptop drawer and visible add-button focus');
  assert(apiState.saveCount === 0, 'laptop gallery open/close must not save or publish');
  // Block-row actions are portaled to document.body. They still belong to
  // the open laptop navigator: hiding and restoring a block must not close
  // the drawer or strand keyboard focus inside a hidden menu.
  const laptopHeroMore = '#editor-block-editor-hero .screen-order-v2-more';
  await clickPointer(client, laptopHeroMore);
  await waitForBrowser(client,
    `!!document.querySelector('[data-composition-action-menu="true"] [role="switch"][aria-checked="true"]')`,
    'laptop block-row action menu opens in a portal owned by the block list');
  await clickPointer(client, '[data-composition-action-menu="true"] [role="switch"]');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-hero')?.classList.contains('is-hidden')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('#editor-block-editor-hero .screen-order-v2-more')`,
    'hiding a block through the portal keeps laptop block list open and trigger focused');
  await clickPointer(client, laptopHeroMore);
  await waitForBrowser(client,
    `!!document.querySelector('[data-composition-action-menu="true"] [role="switch"][aria-checked="false"]')`,
    'hidden block can reopen its action menu without reopening the drawer');
  await clickPointer(client, '[data-composition-action-menu="true"] [role="switch"]');
  await waitForBrowser(client,
    `!document.querySelector('#editor-block-editor-hero')?.classList.contains('is-hidden')
      && document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'
      && document.activeElement === document.querySelector('#editor-block-editor-hero .screen-order-v2-more')`,
    'restoring a block through the portal preserves the open laptop navigator');
  // On laptops the open navigator covers the left settings. Click the still
  // visible right page to verify genuine outside-pointer dismissal.
  await clickPointer(client, '.preview-stage-heading');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'false'
      && !document.querySelector('.editor-composition-panel')?.contains(document.activeElement)`,
    'clicking outside in the right page dismisses the drawer without hidden focus');
  await clickPointer(client, '.editor-navigator-drawer-trigger');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'`,
    'laptop drawer reopens for real preview control interaction');
  await clickPointer(client, '.preview-stage-width');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'false'
      && document.querySelector('.preview-stage-width')?.textContent.trim() === '모바일 390px'`,
    'single preview width label remains visible while an open drawer dismisses');
  assert(apiState.saveCount === 0, 'outside drawer clicks must not save or publish the page');
  await setViewport(client, 1672, 941, false);
  // A real page-first workflow: selecting visible content edits the exact
  // existing field. Cancel must leave the staged and published page intact.
  await focusSelector(client, '.phone-frame #block-editor-hero h1.editor-inline-text-trigger');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `!!document.querySelector('.phone-frame #block-editor-hero textarea[aria-label="히어로 제목 바로 수정"]')`,
    'hero headline opens an in-canvas editor without switching page layout');
  await capture(client, 'hero-headline-inline-edit');
  await clickPointer(client, '.phone-frame #block-editor-hero .editor-inline-text-actions button:first-child');
  await waitForBrowser(client,
    `!document.querySelector('.phone-frame #block-editor-hero textarea[aria-label="히어로 제목 바로 수정"]')`,
    'hero cancel returns to its rendered headline');
  await clickPointer(client, '.phone-frame #block-editor-form h2');
  await waitForBrowser(client,
    `document.activeElement === document.querySelector('#editor-block-settings-editor-form .form-basic-grid .field-title input')`,
    'form headline selects matching existing inspector title field').catch(async (error) => {
    const actual = await evaluate(client, `(() => ({
      selectedForm: document.querySelector('#editor-block-editor-form')?.dataset.selected,
      inspectorForm: !!document.querySelector('#editor-block-settings-editor-form'),
      formTitleInput: !!document.querySelector('#editor-block-settings-editor-form .form-basic-grid .field-title input'),
      focused: document.activeElement?.outerHTML?.slice(0, 280),
      pageOptions: !!document.querySelector('.editor-page-options-stack'),
    }))()`);
    throw new Error(error.message + ': ' + JSON.stringify(actual));
  });
  await waitForBrowser(client, `!!document.querySelector('.phone-frame #block-editor-form .editor-preview-submit-edit')`,
    'selected form exposes its button-copy editing shortcut');
  await clickPointer(client, '.phone-frame #block-editor-form .editor-preview-submit-edit');
  await waitForBrowser(client,
    `document.activeElement === document.querySelector('#editor-block-settings-editor-form .form-editor-flow > .field-title input')`,
    'form submit-copy shortcut focuses exact existing field, never submits');
  assert(apiState.saveCount === 0, 'preview editing shortcuts do not publish pages or persist test leads');
  await capture(client, 'form-direct-title-and-submit-edit');
  // Page-settings keyboard access is tested after the direct form shortcuts,
  // so clearing selection cannot change the starting state of those checks.
  await setViewport(client, 900, 941, false);
  // Explicit page-settings selection closes the same laptop drawer. The
  // focused footer button becomes hidden, so focus must move to the real
  // page-options heading in the persistent left settings panel.
  await clickPointer(client, '.editor-navigator-drawer-trigger');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'true'`,
    'laptop drawer reopens before page-options keyboard selection');
  await focusSelector(client, '.editor-page-settings-button');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded') === 'false'
      && !!document.querySelector('[data-editor-section="options"] .editor-page-options-stack')
      && document.activeElement === document.querySelector('[data-editor-section="options"] .editor-page-options-heading h2')
      && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2
      && getComputedStyle(document.activeElement).outlineStyle !== 'none'
      && document.querySelector('.editor-properties-content')?.scrollTop === 0`,
    'page-options keyboard selection closes the laptop drawer and visibly focuses its inspector heading').catch(async (error) => {
    const actual = await evaluate(client, `(() => {
      const heading = document.querySelector('[data-editor-section="options"] .editor-page-options-heading h2');
      const active = document.activeElement;
      return {
        drawer: document.querySelector('.editor-navigator-drawer-trigger')?.getAttribute('aria-expanded'),
        pageOptions: !!document.querySelector('[data-editor-section="options"] .editor-page-options-stack'),
        headingPresent: !!heading, headingFocused: active === heading,
        headingTabIndex: heading?.tabIndex, headingOutline: heading ? getComputedStyle(heading).outlineWidth : '',
        activeElement: active?.outerHTML?.slice(0, 280),
        activeOutline: active ? getComputedStyle(active).outlineWidth : '',
        inspectorScroll: document.querySelector('.editor-properties-content')?.scrollTop,
      };
    })()`);
    throw new Error(error.message + ': ' + JSON.stringify(actual));
  });
  assert(apiState.saveCount === 0, 'opening page options must not save or publish the page');
  await setViewport(client, 1672, 941, false);
  // Page-global design uses a dedicated overlay over the left workbench.
  // Explicitly return to the list before opening a different block; never
  // fake a click on a row that is visually covered by page settings.
  await clickPointer(client, '.editor-workbench-close-inspector');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inspectorOpen === 'false'
    && !!document.querySelector('#editor-composition-panel .screen-order-v2-head')`,
    'closing page design restores the editable block list');

  // A visual redesign must change the *first visible task*, not just CSS
  // tokens. Verify real editor settings and capture each of four block types.
  for (const [id, heading, primarySelector, advancedSelector] of [
    ['editor-text', '내용 수정', '.text-editor-flow > .editor-field-v2--body-text textarea', '.text-editor-design'],
    ['editor-image', '사진 변경', '.image-editor-flow .image-input-upload-action', '.image-editor-more'],
    ['editor-form', '문의 폼 편집', '.form-editor-flow .form-question-title', '.form-behavior-detail'],
    ['editor-code', '코드 편집', '.code-editor-box textarea', '.code-editor-options'],
  ]) {
    await clickNavigatorRow(`#editor-block-${id} .screen-order-v2-head`);
    await waitForBrowser(client,
      `!!document.querySelector('#editor-block-settings-${id} ${primarySelector}')`,
      'content-first primary task loads for ' + id);
    const firstView = await evaluate(client, `(() => {
      const scope = document.querySelector('#editor-block-settings-${id}');
      const primary = scope?.querySelector('${primarySelector}');
      const secondary = scope?.querySelector('${advancedSelector}');
      const heading = scope?.closest('.editor-inline-settings')?.querySelector('.screen-order-v2-settings-title h2');
      const identity = scope?.closest('.editor-inline-settings')?.querySelector('.editor-inspector-selected-copy');
      const code = scope?.querySelector('.code-editor-box textarea');
      const body = scope?.querySelector('.text-editor-flow > .editor-field-v2--body-text textarea');
      return {
        heading: heading?.textContent.trim(),
        headingVisible: !!heading?.getClientRects().length && !!heading?.textContent.trim(),
        identityVisible: !!identity && !!identity.getClientRects().length,
        primaryVisible: !!primary?.getClientRects().length,
        primaryHeight: primary?.getBoundingClientRect().height || 0,
        secondaryClosed: secondary?.tagName === 'DETAILS' && secondary.open === false,
        bodyVisible: !!body?.getClientRects().length,
        directCode: ${JSON.stringify(id)} === 'editor-code' ? code?.getBoundingClientRect().height >= 290 : true,
      };
    })()`);
    assert(firstView.headingVisible && firstView.identityVisible && firstView.primaryVisible
      && firstView.primaryHeight >= 30 && firstView.secondaryClosed && firstView.directCode
      && (id !== 'editor-text' || firstView.bodyVisible),
      'redesigned inspector exposes actual content before optional settings: ' + JSON.stringify({ id, firstView }));
    const selectionPhoneLeft = await evaluate(client,
      `document.querySelector('.phone-frame')?.getBoundingClientRect().left`);
    assert(Math.abs(selectionPhoneLeft - pinnedPhoneLeft) <= 2,
      'switching between text, image, form and code must not move the 390px live preview: '
        + JSON.stringify({ id, selectionPhoneLeft, pinnedPhoneLeft }));
    if (id === 'editor-code') {
      const wideCode = await evaluate(client, `(() => {
        const rect = node => node?.getBoundingClientRect();
        const layout = document.querySelector('.edit-layout');
        const inspector = rect(document.querySelector('.editor-properties-panel'));
        const code = rect(document.querySelector('#editor-block-settings-editor-code .code-editor-box textarea'));
        const phone = rect(document.querySelector('.phone-frame'));
        return {
          selected: layout?.dataset.selectedBlockType,
          inspectorWidth: inspector?.width,
          inlineWidth: rect(document.querySelector('.editor-inline-expanded'))?.width,
          inlineEditorCount: document.querySelectorAll('#editor-block-settings-editor-code').length,
          inputWidth: code?.width,
          phoneOffset: phone?.left - inspector?.right,
          phoneRightInset: window.innerWidth - phone?.right,
          actualPageWidth: document.querySelector('.phone-frame .landing-page')?.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      })()`);
      assert(wideCode.selected === 'code' && wideCode.inspectorWidth === 0
        && wideCode.inlineWidth >= 510 && wideCode.inlineEditorCount === 1
        && wideCode.inputWidth >= 490
        && Math.abs(wideCode.phoneRightInset - 28) <= 3
        && wideCode.actualPageWidth === 390
        && wideCode.documentWidth <= 1672,
        'wide code edit must use free canvas space without squashing or hiding the actual page: '
          + JSON.stringify(wideCode));

      await setViewport(client, 1440, 941, false);
      await waitForBrowser(client, `(() => {
        const layout = document.querySelector('.edit-layout');
        const code = document.querySelector('#editor-block-settings-editor-code .code-editor-box textarea');
        const phone = document.querySelector('.phone-frame');
        return layout?.dataset.selectedBlockType === 'code'
          && layout.dataset.inlineEditing === 'true'
          && code?.getBoundingClientRect().width >= 490
          && Math.abs(1440 - phone?.getBoundingClientRect().right - 28) <= 3
          && document.querySelector('.phone-frame .landing-page')?.clientWidth === 390;
      })()`, 'inline code remains readable and the same page stays pinned at 1440px');
      await setViewport(client, 1672, 941, false);
      await waitForBrowser(client,
        `document.querySelector('#editor-block-settings-editor-code .code-editor-box textarea')?.getBoundingClientRect().width >= 490`,
        'inline code editor remains wide on desktop without a second editor instance');
    }
    if (id === 'editor-text' || id === 'editor-image' || id === 'editor-form' || id === 'editor-code') {
      await capture(client, 'inspector-content-first-' + id);
    }
  }
  await clickNavigatorRow('#editor-block-editor-text .screen-order-v2-head');
  // The inspector's own "more" menu must invoke the same visibility action
  // as the left block list. An unbound switch used to look interactive but
  // silently left the block visible in the actual page draft.
  const inspectorTextMore = '#editor-selection-panel .screen-order-v2-more';
  const inspectorTextVisibility = '#screen-order-actions-editor-text-inspector [role="switch"]';
  await clickPointer(client, inspectorTextMore);
  await waitForBrowser(client,
    `document.querySelector('${inspectorTextVisibility}')?.getAttribute('aria-checked') === 'true'`,
    'inspector action menu exposes the selected visible text block');
  await clickPointer(client, inspectorTextVisibility);
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-text')?.classList.contains('is-hidden')
      && !!document.querySelector('#editor-selection-panel .screen-order-settings-hidden')
      && !!document.querySelector('#editor-block-settings-editor-text')
      && document.querySelector('${inspectorTextMore}')?.getAttribute('aria-expanded') === 'false'`,
    'inspector visibility action hides the real block while keeping its editor selected');
  await clickPointer(client, inspectorTextMore);
  await waitForBrowser(client,
    `document.querySelector('${inspectorTextVisibility}')?.getAttribute('aria-checked') === 'false'`,
    'inspector menu reflects the newly hidden block');
  await clickPointer(client, inspectorTextVisibility);
  await waitForBrowser(client,
    `!document.querySelector('#editor-block-editor-text')?.classList.contains('is-hidden')
      && !document.querySelector('#editor-selection-panel .screen-order-settings-hidden')
      && !!document.querySelector('#editor-block-settings-editor-text')
      && document.querySelector('${inspectorTextMore}')?.getAttribute('aria-expanded') === 'false'`,
    'inspector visibility switch restores the block and real settings state');
  assert(apiState.saveCount === 0, 'inspector visibility switch must not automatically save or publish');
  await clickNavigatorRow('#editor-block-settings-editor-text .text-editor-design > summary');
  const optionalText = await evaluate(client, `(() => {
    const panel = document.querySelector('#editor-block-settings-editor-text');
    return {
      open: panel?.querySelector('.text-editor-design')?.open,
      spacingVisible: !!panel?.querySelector('.widget-spacing-controls')?.getClientRects().length,
      colorVisible: !!panel?.querySelector('input[aria-label="글자색 HEX"]')?.getClientRects().length,
    };
  })()`);
  assert(optionalText.open && optionalText.spacingVisible && optionalText.colorVisible,
    'one optional text design disclosure must reveal original text style and spacing actions: '
    + JSON.stringify(optionalText));
  await clickNavigatorRow('#editor-block-settings-editor-text .text-editor-design > summary');
  // PageRo's design shortcuts navigate the existing editor, rather than
  // maintaining parallel content/design state or duplicating form fields.
  const inspectorShortcuts = await evaluate(client, `(() => {
    const panel = document.querySelector('.editor-composition-content .editor-inline-expanded')
      || document.querySelector('.editor-properties-panel');
    const shortcuts = panel?.querySelectorAll('.editor-inspector-jump button') || [];
    return { labels: [...shortcuts].map(button => button.textContent.trim()),
      scrollArea: !!panel?.closest('.editor-composition-content') || !!panel?.querySelector('.editor-properties-content'),
      buttonHeight: shortcuts[0]?.getBoundingClientRect().height || 0 };
  })()`);
  assert(JSON.stringify(inspectorShortcuts.labels) === JSON.stringify(['내용', '디자인'])
    && inspectorShortcuts.scrollArea && inspectorShortcuts.buttonHeight >= 34,
    'selected block must expose accessible content and design shortcuts: ' + JSON.stringify(inspectorShortcuts));
  await clickPointer(client, '.editor-inspector-jump button:nth-child(2)');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open === true`,
    'design shortcut expands the original text design disclosure');
  await clickPointer(client, '.editor-inspector-jump button:first-child');
  await waitForBrowser(client,
    `document.querySelector('.editor-properties-content')?.scrollTop <= 40`,
    'content shortcut returns to the beginning of the separate settings inspector');
  await clickPointer(client, '#editor-block-settings-editor-text .text-editor-design > summary');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open === false`,
    'closing design after shortcut preserves original disclosure semantics');
  assert(apiState.saveCount === 0, 'inspector shortcuts must never persist or publish settings');
  // Prior QA scenarios may leave a block selected. Explicitly enter page-level
  // editing to verify that clearing the selected block never hides the inspector.
  await clickNavigatorRow('.editor-page-settings-button');
  await waitForBrowser(client, `!!document.querySelector('.editor-page-options-stack')`,
    'unselected page shows real design controls in the permanent inspector');
  const unselected = await evaluate(client, `(() => {
    const pageOptions = document.querySelector('.editor-page-options-stack');
    const inspector = document.querySelector('.editor-inspector-panel');
    const composition = document.querySelector('.editor-composition-panel');
    const work = document.querySelector('.work-panel');
    const preview = document.querySelector('.preview-workspace');
    return { hasPageOptions:!!pageOptions, inspectorDisplay:getComputedStyle(inspector).display,
      listWidth:composition.getBoundingClientRect().width, inspectorWidth:document.querySelector('.editor-properties-panel').getBoundingClientRect().width,
      editorWidth:work.getBoundingClientRect().width, previewWidth:preview.getBoundingClientRect().width };
  })()`);
  assert(unselected.hasPageOptions && unselected.inspectorDisplay !== 'none'
    && Math.abs(unselected.editorWidth - 560) <= 3
    && Math.abs(unselected.listWidth - unselected.editorWidth) <= 3
    && Math.abs(unselected.inspectorWidth - 560) <= 3
    && unselected.previewWidth >= 600,
    'page-global design must reuse the left workbench without squeezing the pinned preview: '
      + JSON.stringify(unselected));
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
  assert(pageControlState?.selected?.height >= 36 && pageControlState.selected.height <= 52
    && parseInt(pageControlState.selected.radius,10) <= 9
    && pageControlState.selected.color === 'rgb(64, 87, 237)'
    && pageControlState.selected.bg === 'rgb(238, 240, 255)'
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
    const owner = document.querySelector('.editor-composition-content');
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
    await setEditorViewport(width);
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
    await setEditorViewport(width);
    for (const [id, designClass, expectedHeading, expectedDesign, expectedBehavior] of [
      ['editor-hero', 'hero-editor-design', '내용 수정', '디자인', ''],
      ['editor-text', 'text-editor-design', '내용 수정', '디자인 조정', ''],
      ['editor-form', 'form-design-detail', '문의 폼 편집', '디자인 조정', '중복 접수와 외부 연동'],
    ]) {
      await clickNavigatorRow(`#editor-block-${id} .screen-order-v2-head`);
      await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-${id}')?.closest('.editor-inline-settings')?.querySelector('.screen-order-v2-settings-title h2')`, 'inline block heading for ' + id);
      await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} .${designClass} > summary > strong')?.textContent?.trim() === ${JSON.stringify(expectedDesign)}`, 'optional inspector design group for ' + id);
      const hierarchy = await evaluate(client, `(() => {
        const panel = document.querySelector('#editor-block-settings-${id}');
        const design = panel?.querySelector('.${designClass}');
        const label = design?.querySelector(':scope > summary > strong');
        const behavior = panel?.querySelector('.form-behavior-detail > summary > strong');
        const body = panel?.querySelector('.block-editor-v2');
        const box = el => el?.getBoundingClientRect();
        return { hasDuplicate: !!document.querySelector('.inspector-navigation'),
          content: panel?.closest('.editor-inline-settings')?.querySelector('.screen-order-v2-settings-title h2')?.textContent?.trim(),
          design: label?.textContent?.trim(),
          designOpen: design?.open,
          behavior: behavior?.textContent?.trim() || '',
          groupX: box(design)?.left, groupRight: box(design)?.right,
          inspectorRight: box(panel)?.right,
          innerWidth: box(body)?.width };
      })()`);
      assert(!hierarchy.hasDuplicate && Boolean(hierarchy.content) && hierarchy.design === expectedDesign
        && hierarchy.behavior === expectedBehavior
        && (id === 'editor-hero' || hierarchy.designOpen === false)
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
          detailTitle: style('.editor-inspector-selected-copy > h2'),
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
      assert(parseFloat(uiType.listTitle?.size) >= 18
        && parseFloat(uiType.detailTitle?.size) >= 14
        && parseFloat(uiType.normalRow?.size) >= 13
        && parseFloat(uiType.fixedRow?.size) >= 13
        && parseFloat(uiType.normalDetail?.size) >= 10
        && parseFloat(uiType.label?.size) >= 12
        && parseFloat(uiType.editor?.gap) >= 12
        && uiType.tokens['--editor-ui-title-size'] === '21px'
        && uiType.tokens['--editor-ui-space-4'] === '18px'
        && uiType.normalRow.color === uiType.fixedRow.color,
        'Littly block typography must remain readable and consistent at ' + width + ' for ' + id + ': ' + JSON.stringify(uiType));
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
      await clickNavigatorRow(`#editor-block-${id} .screen-order-v2-head`);
      await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-${id} ${selector} > summary')`,
        'shared design disclosure exists for ' + id);
      const before = await evaluate(client, `(() => {
        const detail = document.querySelector('#editor-block-settings-${id} ${selector}');
        return { open: detail?.open, bodyVisible: !!detail?.querySelector(':scope > .inspector-disclosure-body')?.getClientRects().length };
      })()`);
      await clickNavigatorRow(`#editor-block-settings-${id} ${selector} > summary`);
      await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} ${selector}')?.open !== ${before.open}`,
        'design disclosure toggles natively for ' + id);
      if (before.open) {
        await clickNavigatorRow(`#editor-block-settings-${id} ${selector} > summary`);
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
        && ['13px', '14px'].includes(expanded.labelSize) && Number(expanded.labelWeight) >= 650
        && expanded.gap === '12px' && expanded.paddingTop === '4px'
        && ['12px', '14px'].includes(expanded.paddingBottom) && expanded.bodyVisible && !expanded.overflow,
        'native design groups should have uniform density at ' + width + ' for ' + id + ': ' + JSON.stringify(expanded));
      if ((width === 900 || width === 1672) && id === 'editor-image')
        await capture(client, 'inspector-group-image-' + width);
      if (!before.open) {
        await clickNavigatorRow(`#editor-block-settings-${id} ${selector} > summary`);
        await waitForBrowser(client, `document.querySelector('#editor-block-settings-${id} ${selector}')?.open === false`,
          'design group recloses for ' + id);
      }
    }
    await clickNavigatorRow('#editor-block-editor-hero .screen-order-v2-head');
    const heroImageBefore = await evaluate(client, `(() => {
      const d = document.querySelector('#editor-block-settings-editor-hero .hero-image-adjustments');
      return {open:d?.open, native:d?.classList.contains('inspector-disclosure')};
    })()`);
    assert(heroImageBefore.native, 'hero image effects must share native disclosure component');
    await clickNavigatorRow('#editor-block-settings-editor-hero .hero-image-adjustments > summary');
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
    await clickNavigatorRow('#editor-block-settings-editor-hero .hero-image-adjustments > summary');
    await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-hero .hero-image-adjustments')?.open === ${heroImageBefore.open}`,
      'hero image disclosure restores original state');
    assert(apiState.saveCount === 0, 'inspector group expand/collapse must never write or publish');
    if (width === 1024 || width === 1672) await capture(client, 'single-hierarchy-form-' + width);
  }
  for (const width of [900, 1440]) {
    await setEditorViewport(width);
    await clickNavigatorRow('.editor-page-settings-button');
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
    assert(pageType.status?.size === '15px' && pageType.status?.weight === '650'
      && pageType.heading?.size === '14px' && pageType.heading?.weight === '650'
      && pageType.label?.size === '14px' && pageType.label?.weight === '600'
      && pageType.panel?.gap === '18px' && pageType.group?.gap === '12px',
      'page-level design inspector matches editor type and spacing at ' + width + ': ' + JSON.stringify(pageType));
    await capture(client, 'unified-page-design-type-' + width);
  }
  await setViewport(client, 1672, 941, false);
  // The preceding reference step opens page-wide theme settings. Close that
  // overlay before selecting a normal block in the newly unified list, since
  // the page-wide Inspector intentionally covers the left block workbench.
  await clickPointer(client, '.editor-workbench-close-inspector');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.inspectorOpen === 'false'
    && document.querySelector('.edit-layout')?.dataset.editorDensity === 'wide'`,
    'page-wide design overlay returns to desktop block list');
  await clickNavigatorRow('#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `!!document.querySelector('.text-editor-flow') && !!document.querySelector('#editor-block-settings-editor-text')?.closest('.editor-inline-expanded') && !document.querySelector('.inspector-navigation')`, 'reference single-hierarchy inline text editor');

  // The redesigned first view keeps design closed. Open it deliberately for
  // secondary-control sizing and focus tests, rather than treating hidden
  // fields as a visual regression.
  if (!(await evaluate(client, `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open`))) {
    await clickNavigatorRow('#editor-block-settings-editor-text .text-editor-design > summary');
  }
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open === true`,
    'optional text design is opened for control geometry tests');

  // A multi-digit size edit must keep input focus until explicit commit.
  // The lazy Inspector can remount after draft updates, so never emit every
  // intermediate digit to the page model while typing.
  const sizeInput = '#editor-block-settings-editor-text .text-editor-design .editor-number-value > input';
  const originalSize = await evaluate(client, `document.querySelector(${JSON.stringify(sizeInput)})?.value`);
  await focusSelector(client, sizeInput);
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2,
  });
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2,
  });
  await client.send('Input.insertText', { text: '36' });
  await waitForBrowser(client, `(() => {
    const el = document.querySelector(${JSON.stringify(sizeInput)});
    return document.activeElement === el && el?.value === '36';
  })()`, 'multi-digit size edit keeps the active numeric input focused');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector(${JSON.stringify(sizeInput)})?.value === '36'`,
    'Enter commits the full numeric value');
  await focusSelector(client, sizeInput);
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2,
  });
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2,
  });
  await client.send('Input.insertText', { text: String(originalSize) });
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector(${JSON.stringify(sizeInput)})?.value === ${JSON.stringify(String(originalSize))}`,
    'size edit restores the original value without touching published content');

  // UX-032: 42px native fields / 36px compact fields / 44px toggle hit area.
  // Check computed styles at compact and wide inspector widths. Keep model
  // values unchanged; disabled states below are DOM-only and immediately reset.
  for (const width of [900, 1024, 1440, 1672]) {
    await setEditorViewport(width);
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
      && metrics.segment.color === 'rgb(64, 87, 237)'
      && metrics.segment.bg === 'rgb(238, 240, 255)'
      && metrics.rail?.height >= 40 && parseInt(metrics.rail.radius,10) <= 9
      && metrics.number?.height >= 36 && metrics.number.height <= 44
      && metrics.hex?.height >= 36 && metrics.hex.height <= 44
      && metrics.swatch?.height >= 36 && metrics.eyedropper?.height >= 36
      && parseInt(metrics.numberBox?.radius,10) <= 9 && parseInt(metrics.hex.radius,10) <= 9
      && Number(metrics.disabledOpacity) <= .5 && !metrics.overflow
      && metrics.swatch.right <= metrics.hex.left
      && metrics.hex.right <= metrics.eyedropper.left
      && metrics.cssToken === '8px',
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

  await clickNavigatorRow('#editor-block-editor-bottom .fixed-block-head');
  await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-editor-bottom .bottom-bar-editor-design > summary')`,
    'bottom fixed CTA exposes real design controls');
  await clickNavigatorRow('#editor-block-settings-editor-bottom .bottom-bar-editor-design > summary');
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
    && switchMetrics.on === 'rgb(64, 87, 237)'
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
  const pinnedInline = await evaluate(client, `(() => {
    const settings = document.querySelector('#editor-block-settings-editor-bottom');
    const properties = document.querySelector('.editor-properties-panel');
    return {
      inline: !!settings?.closest('[data-fixed-group="bottom"] .editor-inline-expanded'),
      visible: !!settings?.getClientRects().length,
      count: document.querySelectorAll('#editor-block-settings-editor-bottom').length,
      inspectorHidden: getComputedStyle(properties).display === 'none',
      actualPageWidth: document.querySelector('.phone-frame .landing-page')?.clientWidth,
    };
  })()`);
  assert(pinnedInline.inline && pinnedInline.visible && pinnedInline.count === 1
    && pinnedInline.inspectorHidden && pinnedInline.actualPageWidth === 390,
    'pinned CTA must expand its one real widget editor beneath its row, never a covering Inspector: '
      + JSON.stringify(pinnedInline));
  await capture(client, 'littly-inline-bottom-fixed-1672');

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

  await clickNavigatorRow('#editor-block-editor-text .screen-order-v2-head');
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
  // Committing/cancelling a Korean IME composition must never be mistaken
  // for selecting a search result or clearing the active search term.
  const imeShortcuts = await evaluate(client, `(() => {
    const input = document.querySelector('input[aria-label="블록 이름 검색"]');
    const composingEnter = new KeyboardEvent('keydown',
      { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    const composingEscape = new KeyboardEvent('keydown',
      { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true, cancelable: true });
    input.dispatchEvent(composingEnter);
    input.dispatchEvent(composingEscape);
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '푸' }));
    const unflaggedEnter = new KeyboardEvent('keydown',
      { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(unflaggedEnter);
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '푸터' }));
    return {
      enterPrevented: composingEnter.defaultPrevented,
      escapePrevented: composingEscape.defaultPrevented,
      unflaggedPrevented: unflaggedEnter.defaultPrevented,
    };
  })()`);
  await waitForBrowser(client,
    `document.querySelector('input[aria-label="블록 이름 검색"]')?.value === '푸터'
      && document.querySelector('.editor-search-count')?.textContent.trim() === '1/1'
      && document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'composing Korean search leaves query, matches and selected editor unchanged');
  assert(!imeShortcuts.enterPrevented && !imeShortcuts.escapePrevented && !imeShortcuts.unflaggedPrevented,
    'Korean IME key events must remain available for the composition system: ' + JSON.stringify(imeShortcuts));
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
  await waitForBrowser(client,
    `document.querySelector('.editor-composition-search input')?.value === ''`,
    'image nickname selection waits until search clears');
  await focusSelector(client, '#editor-block-editor-image .screen-order-v2-title-wrap');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-image')?.dataset.selected === 'true'`,
    'image row keyboard activation selects its inline editor after search clears');
  await waitForBrowser(client, `!!document.querySelector('#editor-block-settings-editor-image input[aria-label="이미지 목록 구분 이름"]')`,
    'image editor offers list-only nickname');
  const originalCaption = await evaluate(client, `document.querySelector('#editor-block-settings-editor-image input[placeholder="이미지 설명을 입력하세요"]')?.value`);
  await setInputValue(client, '#editor-block-settings-editor-image input[aria-label="이미지 목록 구분 이름"]', '본식 사진 QA');
  await waitForBrowser(client, `(() => {
    const row = document.querySelector('#editor-block-editor-image');
    return row?.querySelector('.screen-order-v2-identity-copy strong')?.textContent === '본식 사진 QA'
      && document.querySelector('.editor-inspector-selected-copy > h2')?.textContent === '본식 사진 QA';
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
    const scroller = document.querySelector('.editor-composition-content');
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
    const scroller = document.querySelector('.editor-composition-content');
    const selected = document.querySelector('#editor-block-editor-text');
    const row = selected?.getBoundingClientRect();
    const view = scroller?.getBoundingClientRect();
    const search = document.querySelector('.editor-composition-search')?.getBoundingClientRect();
    return !!row && !!view && !!search && row.top >= search.bottom - 2
      && row.bottom <= view.bottom + 2 && selected.dataset.selected === 'true';
  })()`, 'selected block appears below sticky navigator');
  const locateAfter = await evaluate(client, `(() => {
    const scroller = document.querySelector('.editor-composition-content');
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
    document.querySelector('.editor-composition-content').scrollTop = 0;
  })()`);
  assert(apiState.saveCount === 0, 'locating the selected block must never save or publish');

  // UX-006: The selected inspector must allow navigating neighboring blocks
  // without a second scrollbar, and keep the correct mobile selection.
  await waitForBrowser(client, `document.querySelector('.editor-block-switch-position')?.textContent?.includes('/')`,
    'selected inspector shows block index');
  await clickPointer(client, '.editor-block-switch-actions button[aria-label="이전 블록"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-hero')?.dataset.selected === 'true'`,
    'inspector previous selects the hero without a list scroll');
  await focusSelector(client, '.editor-block-switch-actions button[aria-label="이전 블록"]');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-topnav')?.dataset.selected === 'true'
      && document.activeElement === document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]')`,
    'keyboard navigation crosses into the pinned top block and focuses its enabled next action');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-hero')?.dataset.selected === 'true'
      && document.activeElement === document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]')`,
    'keyboard navigation returns from pinned top to first content block without losing focus');
  await clickPointer(client, '.editor-block-switch-actions button[aria-label="다음 블록"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'inspector next returns to the text block');
  // A repeated previous/next keyboard action must not place focus on the
  // heading or document body every time the selected editor remounts.
  const inspectorNext = '.editor-block-switch-actions button[aria-label="다음 블록"]';
  await focusSelector(client, inspectorNext);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-form')?.dataset.selected === 'true'
      && document.activeElement === document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]')`,
    'Enter navigates from text to form while retaining next-button keyboard focus');
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client,
    `document.querySelector('#editor-block-editor-code')?.dataset.selected === 'true'
      && document.activeElement === document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]')`,
    'another Enter navigates from form to code without re-tabbing through the inspector');
  await clickPointer(client, '.editor-block-switch-actions button[aria-label="이전 블록"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-form')?.dataset.selected === 'true'`,
    'keyboard-navigation regression returns to the form');
  await clickPointer(client, '.editor-block-switch-actions button[aria-label="이전 블록"]');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'keyboard-navigation regression restores the text fixture');
  assert(apiState.saveCount === 0, 'repeated inspector keyboard navigation must not save or publish');

  // 16th patch: a deep composition should keep the selected row visible when
  // switching via inspector previous/next, rather than resetting scrollTop=0.
  // DOM-only clones add depth; React page data and saved block order are untouched.
  const inspectorDepth = await evaluate(client, `(() => {
    const list = document.querySelector('.screen-order-v2-list');
    const image = document.querySelector('#editor-block-editor-image')?.closest('.screen-order-v2-slot');
    const scroller = document.querySelector('.editor-composition-content');
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
    const scroller = document.querySelector('.editor-composition-content');
    const row = document.querySelector('#editor-block-editor-image');
    const search = document.querySelector('.editor-composition-search');
    const bounds = row?.getBoundingClientRect();
    return row?.dataset.selected === 'true'
      && !!bounds && bounds.top >= search.getBoundingClientRect().bottom + 4
      && bounds.bottom < scroller.getBoundingClientRect().bottom
      && scroller.scrollTop > 350;
  })()`, 'deep inspector next locates the selected image row without jumping to top');
  const imageScroll = await evaluate(client, `document.querySelector('.editor-composition-content').scrollTop`);
  await evaluate(client, `document.querySelector('.editor-block-switch-actions button[aria-label="다음 블록"]').click()`);
  await waitForBrowser(client, `(() => {
    const scroller = document.querySelector('.editor-composition-content');
    const row = document.querySelector('#editor-block-editor-bottom');
    const search = document.querySelector('.editor-composition-search');
    const bounds = row?.getBoundingClientRect();
    return row?.dataset.selected === 'true'
      && !!bounds && bounds.top >= search.getBoundingClientRect().bottom - 2
      && bounds.bottom < scroller.getBoundingClientRect().bottom
      && scroller.scrollTop > 350;
  })()`, 'deep inspector next finds the lower fixed CTA instead of losing its list position');
  const bottomScroll = await evaluate(client, `document.querySelector('.editor-composition-content').scrollTop`);
  assert(imageScroll > 350 && bottomScroll > 350, 'deep navigation must never reset to the list start');
  await evaluate(client, `(() => {
    document.querySelectorAll('[data-qa-deep-switch-clone]').forEach((node) => node.remove());
    document.querySelector('.editor-composition-content').scrollTop = 0;
  })()`);
  await clickNavigatorRow('#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'deep inspector regression returns to the original text editor');
  assert(apiState.saveCount === 0, 'inspector navigation must not save or publish the page');

  // A long navigator list must not push the Inspector's own header away.
  // DOM-only clones; no page data writes.
  const longInspector = await evaluate(client, `(() => {
    const list = document.querySelector('.screen-order-v2-list');
    const seed = list?.querySelector('.screen-order-v2-slot');
    const scroller = document.querySelector('.editor-composition-content');
    const header = document.querySelector('.screen-order-v2-settings-header');
    const inspector = document.querySelector('.editor-properties-panel');
    const properties = document.querySelector('.editor-properties-content');
    if (!seed || !header || !scroller || !inspector || !properties) return null;
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
      const inspectorBox = inspector.getBoundingClientRect();
      const title = header.getBoundingClientRect();
      return { scrolled: scroller.scrollTop,
        titleTop: title.top, inspectorTop: inspectorBox.top,
        inspectorOverflow: getComputedStyle(properties).overflowY,
        navigatorOverflow: getComputedStyle(scroller).overflowY,
        outerOverflow: getComputedStyle(document.querySelector('.work-panel')).overflowY };
    } finally {
      clones.forEach((clone) => clone.remove());
      scroller.scrollTop = 0;
    }
  })()`);
  assert(longInspector?.scrolled > 250
    && longInspector.inspectorOverflow === 'auto'
    && longInspector.navigatorOverflow === 'auto'
    && longInspector.outerOverflow === 'hidden'
    && longInspector.titleTop >= longInspector.inspectorTop,
    'long block navigation must not displace the separate settings inspector: ' + JSON.stringify(longInspector));
  const before = await evaluate(client, `[...document.querySelectorAll('.text-editor-flow textarea')].map(el => el.value)`);
  const title = '.text-editor-flow textarea';
  await clickPointer(client, title);
  await setInputValue(client, title, '더 나은 세상을 만드는\n당신의 아이디어');
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open === true`,
    'typing content must not close a user-opened design group');
  // Styling is initially hidden, but may already be expanded by a prior
  // control-focus test. Preserve either state without closing it accidentally.
  if (!(await evaluate(client, `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open`))) {
    await clickNavigatorRow('#editor-block-settings-editor-text .text-editor-design > summary');
  }
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .text-editor-design')?.open === true`,
    'text design controls remain reachable explicitly');
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
  await evaluate(client, `document.querySelector('.editor-composition-content').scrollTop = 0`);

  const geometry = await evaluate(client, `(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,top:r.top,height:r.height}; };
    const stage = document.querySelector('.preview-workspace');
    const list = document.querySelector('.editor-composition-panel');
    const inspector = document.querySelector('.editor-properties-panel');
    const properties = document.querySelector('.editor-properties-content');
    return { header: rect(document.querySelector('.workspace-persistent-header')), list:rect(list), inspector:rect(inspector), stage:rect(stage), phone:rect(document.querySelector('.phone-frame')), pageWidth:document.querySelector('.phone-frame .landing-page').clientWidth,
      phones:stage.querySelectorAll('.phone-frame').length, stageChildren:stage.children.length, widthOptions:stage.querySelectorAll('.preview-device-widths button').length, documentWidth:document.documentElement.scrollWidth,
      inlineEditors:document.querySelectorAll('.editor-composition-content .editor-inline-expanded').length,
      listScroll:getComputedStyle(list).overflowY,
      navigatorScroll:getComputedStyle(list.querySelector('.editor-composition-content')).overflowY,
      inspectorScroll:getComputedStyle(properties).overflowY,
      labels:[...document.querySelectorAll('.editor-composition-panel .screen-order-v2-identity-copy strong')].map(el => ({
        label: el.textContent, whiteSpace:getComputedStyle(el).whiteSpace, height:el.getBoundingClientRect().height,
        lineHeight:parseFloat(getComputedStyle(el).lineHeight), clipped:el.scrollWidth>el.clientWidth
      })),
      redundantNav:!!document.querySelector('.workspace-persistent-header > .workspace-editor-nav'),
      ancestors:['.builder-shell','.work-panel','.edit-layout'].map(selector => { const el=document.querySelector(selector), css=getComputedStyle(el);return {selector,...rect(el),scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,height:css.height,minHeight:css.minHeight,rows:css.gridTemplateRows,overflow:css.overflowY}; }) };
  })()`);
  console.log('reference geometry:', JSON.stringify(geometry));
  await capture(client, 'desktop-reference-editor-1672');
  assert(Math.abs(geometry.header.height - 64) <= 1 && Math.abs(geometry.list.width - 560) <= 3
    && geometry.inspector.width === 0
    && geometry.list.right <= geometry.phone.left - 12
    && geometry.inlineEditors === 1,
    'wide layout must contain one inline block editor and one right-side mobile result: ' + JSON.stringify(geometry));
  assert(Math.abs(geometry.list.top - 64) <= 1
    && Math.abs(geometry.stage.top - 64) <= 1,
    'block workbench and pinned result must align below the 64px toolbar: ' + JSON.stringify(geometry));
  assert(geometry.ancestors[1].height.endsWith('px') && geometry.ancestors[1].overflow === 'hidden'
    && geometry.ancestors[1].scrollTop === 0,
    'work panel must remain stationary while the two editing regions scroll: ' + JSON.stringify(geometry));
  assert(geometry.labels.length >= 4
    && geometry.labels.every(label => label.whiteSpace === 'normal' && label.height <= label.lineHeight * 2 + 2),
    'long Korean block names must fit within two lines without overlapping actions: ' + JSON.stringify(geometry.labels));
  assert(geometry.pageWidth === 390 && geometry.phones === 1 && geometry.stageChildren === 1 && geometry.widthOptions === 0
    && geometry.documentWidth <= 1672 && !geometry.redundantNav
    && geometry.listScroll === 'hidden' && geometry.navigatorScroll === 'auto'
    && geometry.inspectorScroll === 'auto'
    && geometry.phone.left >= geometry.list.right + 12
    && Math.abs(1672 - geometry.phone.right - 28) <= 3,
    'real page must remain centered with independent list and inspector scrolling: ' + JSON.stringify(geometry));

  // 21st patch: preview stage is the page itself. No redundant resolution,
  // zoom, fullscreen, or floating block-action toolbars above the phone.
  for (const width of [900, 1024, 1440, 1672]) {
    await setEditorViewport(width);
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
        stageRightPinned: box(frame).left - box(document.querySelector('.editor-properties-panel')).right >= 8
          && Math.abs(box(preview).right - box(frame).right - (innerWidth < 1280 ? 12 : 28)) <= 3,
        frameInside: box(frame).left >= box(preview).left - 2 && box(frame).right <= box(preview).right + 2,
        children: stage.children.length,
        hasLegacyToolbar: !!stage.querySelector('.preview-stage-toolbar,.preview-selection-toolbar,.preview-view-tools,.preview-width-toolbar'),
        canvasAdd: !!stage.querySelector('.editor-canvas-bottom-add'),
        canvasTools: !!stage.querySelector('.editor-canvas-tools'),
        selectedBlocks: frame.querySelectorAll('[data-preview-selected="true"]').length,
      };
    })()`);
    const expectedWidth = 394;
    assert(chrome.contentWidth === 390 && Math.abs(chrome.frameWidth - expectedWidth) < 2
      && parseInt(chrome.radius, 10) <= 20 && chrome.stageRightPinned && chrome.frameInside
      && chrome.children === 2 && (chrome.canvasTools || chrome.canvasAdd) && !chrome.hasLegacyToolbar,
      'canvas must show a single real 390px page with a compact inline action row at ' + width + ': ' + JSON.stringify(chrome));
    if (width === 900 || width === 1440) await capture(client, 'clean-phone-stage-' + width);
  }
  await setViewport(client, 1672, 941, false);

  // A single 390px real page is intentional; never reintroduce width buttons.
  assert(await evaluate(client, `document.querySelector('.preview-device-widths') === null
    && document.querySelector('.preview-stage-width')?.textContent.trim() === '모바일 390px'
    && document.querySelector('.phone-frame .landing-page')?.clientWidth === 390`),
    'the real page stays 390px with no competing resolution controls');

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
      const tools = document.querySelector('.editor-canvas-tools');
      return { width: phone.querySelector('.landing-page')?.clientWidth,
        picked: picked?.id || '', toolbarId: tools?.dataset.canvasBlockId || '' };
    })()`);
    assert(stage.width === 390 && (blockId === 'editor-bottom'
      ? !stage.toolbarId : stage.toolbarId === blockId),
      'selecting a normal section must show its exact editor-only canvas actions, while fixed controls remain in the navigator: ' + JSON.stringify(stage));
  }
  await clickNavigatorRow('#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('#editor-block-editor-text')?.dataset.selected === 'true'`,
    'return to selected text with its contextual canvas actions');
  assert(apiState.saveCount === 0, 'preview selections never publish or mutate the saved page');

  const menu = '.workspace-editor-nav > summary';
  await focusSelector(client, menu);
  await pressKeyboardKey(client, 'Enter');
  await waitForBrowser(client, `document.querySelector('.workspace-editor-nav').open && document.querySelector('#workspace-tab-inbox').getClientRects().length > 0`, 'workspace menu opens by keyboard');
  await pressKeyboardKey(client, 'Escape');
  assert(await evaluate(client, `!document.querySelector('.workspace-editor-nav').open && document.activeElement === document.querySelector('.workspace-editor-nav > summary')`), 'workspace menu Escape restores trigger focus');
  await clickPointer(client, '.add-toggle');
  await waitForBrowser(client, `!!document.querySelector('.editor-gallery-dialog[aria-modal="true"] .editor-gallery-quick-grid')`,
    'full-size block gallery opens from navigator');
  const gallery = await evaluate(client, `(() => {
    const dialog = document.querySelector('.editor-gallery-dialog');
    return { width: dialog?.getBoundingClientRect().width,
      quickCards: dialog?.querySelectorAll('.editor-gallery-quick').length,
      quickVisible: !!dialog?.querySelector('.editor-gallery-quick-grid')?.getClientRects().length,
      catalogHidden: !!dialog?.querySelector('.editor-block-gallery-all[hidden]'),
      searchFocused: document.activeElement === dialog?.querySelector('input[aria-label="추가할 블록 검색"]'),
      categoryCount: dialog?.querySelectorAll('.editor-gallery-categories button').length,
      catalog: !!dialog?.querySelector('.widget-group-grid') };
  })()`);
  assert(gallery.width >= 680 && gallery.width <= 760 && gallery.quickCards === 8
    && gallery.quickVisible && gallery.catalogHidden && gallery.searchFocused && gallery.categoryCount >= 5 && gallery.catalog,
    'Littly-style block picker must be readable and keyboard-ready: ' + JSON.stringify(gallery));
  await capture(client, 'editor-visual-block-gallery-1672');
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client, `!document.querySelector('.editor-gallery-dialog')`, 'gallery Escape closes modal');
  await clickPointer(client, '.editor-canvas-tools button[aria-label="선택한 블록 아래에 추가"]');
  await waitForBrowser(client, `!!document.querySelector('.editor-gallery-dialog[aria-modal="true"]')`,
    'on-canvas add opens same gallery without selecting a different block');
  await pressKeyboardKey(client, 'Escape');
  await waitForBrowser(client, `!document.querySelector('.editor-gallery-dialog')`,
    'canvas-initiated gallery closes by keyboard');
  await clickNavigatorRow('#editor-block-settings-editor-text .block-editor-advanced-settings > summary');
  await waitForBrowser(client, `document.querySelector('#editor-block-settings-editor-text .block-editor-advanced-settings').open`, 'single advanced group opens the anchor control');
  await evaluate(client, `document.querySelector('.editor-composition-content').scrollTop = 0`);
  await waitForBrowser(client, `document.querySelector('.editor-composition-content').scrollTop === 0`, 'navigator scroll remains independently available');

  assert(await evaluate(client, `!document.querySelector('.preview-selection-toolbar,.preview-stage-toolbar')`),
    'removed preview chrome must stay absent after editing and selection');

  await setInputValue(client, title, before[0]);
  await focusSelector(client, 'input[aria-label="제목 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="제목 크기 (px)"]', '24');
  await focusSelector(client, 'input[aria-label="본문 크기 (px)"]');
  await setInputValue(client, 'input[aria-label="본문 크기 (px)"]', '15');
  await focusSelector(client, title);
  assert(apiState.saveCount === 0, 'reference editor actions must stay local until explicit publish');

  // Owner's 673px screenshot is a failure case that the prior 900/1672 QA
  // never covered: list + inspector consumed all usable width and the real
  // page was reduced to a blank strip. Compact task mode MUST show a full
  // 390px page first, then offer complete block and content views separately.
  await setViewport(client, 673, 960, false);
  await waitForBrowser(client,
    `document.querySelector('.edit-layout')?.dataset.editorDensity === 'compact'
      && document.querySelector('.edit-layout')?.dataset.compactView === 'page'`,
    '673px content editor uses page-first task layout, not three columns').catch(async (error) => {
      const actual = await evaluate(client, `(() => {
        const shell = document.querySelector('.builder-shell');
        const layout = document.querySelector('.edit-layout');
        const tab = document.querySelector('.editor-workflow-compact-switch');
        const rect = (el) => el?.getBoundingClientRect();
        return {
          width: innerWidth, documentWidth: document.documentElement.clientWidth,
          visualWidth: visualViewport?.width, shellWidth: rect(shell)?.width,
          shellClasses: shell?.className, panelExists: !!layout,
          density: layout?.dataset.editorDensity, view: layout?.dataset.compactView,
          switcher: rect(tab)?.height, switcherDisplay: tab && getComputedStyle(tab).display,
          listDisplay: getComputedStyle(document.querySelector('.editor-composition-panel')).display,
          inspectorDisplay: getComputedStyle(document.querySelector('.editor-properties-panel')).display,
          previewDisplay: getComputedStyle(document.querySelector('.preview-workspace')).display,
        };
      })()`);
      throw new Error(error.message + ' | actual=' + JSON.stringify(actual));
    });
  const compactPage = await evaluate(client, `(() => {
    const rect = (element) => element?.getBoundingClientRect();
    const pane = document.querySelector('.preview-workspace');
    const phone = pane?.querySelector('.phone-frame');
    const content = phone?.querySelector('.landing-page');
    const switcher = document.querySelector('.editor-workflow-compact-switch');
    return {
      viewport: innerWidth,
      density: document.querySelector('.edit-layout')?.dataset.editorDensity,
      view: document.querySelector('.edit-layout')?.dataset.compactView,
      tabs: [...switcher.querySelectorAll('button')].map((el) => ({name: el.textContent, on: el.getAttribute('aria-pressed') === 'true'})),
      pageWidth: content?.clientWidth,
      phoneLeft: rect(phone)?.left, phoneRight: rect(phone)?.right,
      previewLeft: rect(pane)?.left, previewRight: rect(pane)?.right,
      previewVisible: !!rect(pane)?.width && getComputedStyle(pane).display !== 'none',
      headerBottom: rect(document.querySelector('.workspace-persistent-header'))?.bottom,
      taskTop: rect(switcher)?.top, taskBottom: rect(switcher)?.bottom,
      previewTop: rect(pane)?.top,
      blockVisible: !!rect(document.querySelector('.editor-composition-panel'))?.width,
      inspectorVisible: !!rect(document.querySelector('.editor-properties-panel'))?.width,
      scrollWidth: document.documentElement.scrollWidth,
    };
  })()`);
  assert(compactPage.density === 'compact' && compactPage.view === 'page'
    && compactPage.tabs.length === 3 && compactPage.tabs.filter((tab) => tab.on).length === 1
    && compactPage.pageWidth === 390 && compactPage.previewVisible
    && compactPage.phoneLeft >= 0 && compactPage.phoneRight <= 673
    && Math.abs((compactPage.phoneLeft + compactPage.phoneRight) / 2
      - (compactPage.previewLeft + compactPage.previewRight) / 2) <= 6
    && compactPage.taskTop >= compactPage.headerBottom - 2
    && compactPage.previewTop >= compactPage.taskBottom - 2
    && !compactPage.blockVisible && !compactPage.inspectorVisible
    && compactPage.scrollWidth <= 676,
    '673px must display a full page rather than a narrow empty preview strip: ' + JSON.stringify(compactPage));
  await capture(client, 'owner-width-673-page-first');

  await clickPointer(client, '.editor-workflow-compact-switch button:nth-child(2)');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.compactView === 'blocks'
    && document.querySelector('.editor-composition-content')?.getBoundingClientRect().width >= 400
    && getComputedStyle(document.querySelector('.preview-workspace')).display === 'none'`,
    '673px block list has its own readable full-width workspace');
  await capture(client, 'owner-width-673-block-list');
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.compactView === 'edit'
    && document.querySelector('.editor-properties-panel')?.getBoundingClientRect().width >= 400
    && !!document.querySelector('#editor-block-settings-editor-text')
    && getComputedStyle(document.querySelector('.preview-workspace')).display === 'none'`,
    'choosing a block opens its full-width editable settings, without a nested miniature inspector');
  assert(await evaluate(client, `document.activeElement === document.querySelector(
    '#editor-block-settings-editor-text')?.closest('.screen-order-v2-settings-view')
      ?.querySelector('.screen-order-v2-settings-title h2')`),
    '673px list selection transfers keyboard focus to the visible text Inspector heading');
  await capture(client, 'owner-width-673-content-edit');
  await clickPointer(client, '.editor-workflow-compact-switch button:first-child');
  await waitForBrowser(client, `document.querySelector('.edit-layout')?.dataset.compactView === 'page'
    && document.querySelector('.preview-workspace .landing-page')?.clientWidth === 390`,
    'returning to the page never changes its true width or its selected block');
  // The canvas quick action used to focus a display:none Inspector field
  // synchronously, leaving keyboard focus stranded as the page disappeared.
  await clickPointer(client, '.editor-canvas-tools button[aria-label="선택한 블록 내용 편집"]');
  await waitForBrowser(client, `(() => {
    const settings = document.querySelector('#editor-block-settings-editor-text');
    return document.querySelector('.edit-layout')?.dataset.compactView === 'edit'
      && settings?.contains(document.activeElement)
      && document.activeElement.matches('input, textarea, button');
  })()`, '673px canvas quick edit focuses the actual visible field after task transition');
  assert(apiState.saveCount === 0, 'task mode switching, selections and canvas quick edit must not publish');
  await setViewport(client, 1280, 900, false);
}
