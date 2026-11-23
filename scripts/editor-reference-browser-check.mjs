// Beginner editor visual/interaction contract. QA content is disposable and
// this test must not save or publish anything to a real account.
// Legacy three-column reference expectations were replaced by one left task
// and a single real 390px preview, in response to the owner's 2026-11-23 UX rejection.
export async function checkReferenceEditor({
  client, evaluate, assert, waitForBrowser, clickPointer,
  capture, setViewport, apiState,
}) {
  const read = () => evaluate(client, '(() => {'
    + ' const layout = document.querySelector(".edit-layout");'
    + ' const shell = document.querySelector(".builder-shell");'
    + ' const list = document.querySelector(".editor-composition-panel");'
    + ' const inspector = document.querySelector(".editor-properties-panel");'
    + ' const work = document.querySelector(".work-panel");'
    + ' const preview = document.querySelector(".preview-workspace");'
    + ' const frame = document.querySelector(".phone-frame");'
    + ' const row = list?.querySelector(".screen-order-v2-identity-copy strong");'
    + ' const add = list?.querySelector(".add-dock-compact .add-toggle");'
    + ' const rc = el => { if (!el) return null; const r = el.getBoundingClientRect();'
    + ' return { left:r.left, right:r.right, width:r.width, top:r.top, bottom:r.bottom }; };'
    + ' return { density:layout?.dataset.editorDensity, view:layout?.dataset.compactView,'
    + ' open:layout?.dataset.inspectorOpen==="true",'
    + ' columns:getComputedStyle(shell).gridTemplateColumns.trim().split(/\\s+/).length,'
    + ' list:rc(list), inspector:rc(inspector), work:rc(work), preview:rc(preview),'
    + ' frame:rc(frame), contentWidth:frame?.querySelector(".landing-page")?.clientWidth,'
    + ' listShown:!!list?.getClientRects().length, inspectorShown:!!inspector?.getClientRects().length,'
    + ' listFont:parseFloat(getComputedStyle(row).fontSize),'
    + ' addHeight:rc(add)?.bottom-rc(add)?.top,'
    + ' previewCount:preview?.querySelectorAll(".phone-frame").length,'
    + ' overflow:document.documentElement.scrollWidth-innerWidth };'
    + '})()');

  const showList = async () => {
    await evaluate(client, '(() => {'
      + ' const layout=document.querySelector(".edit-layout");'
      + ' if (layout?.dataset.editorDensity==="compact") {'
      + '   if (layout.dataset.compactView!=="blocks")'
      + '     [...layout.querySelectorAll(".editor-workflow-compact-switch button")]'
      + '       .find(b=>b.textContent.trim()==="블록 목록")?.click();'
      + ' } else if (layout?.dataset.inspectorOpen==="true")'
      + '   layout.querySelector(".editor-workbench-close-inspector")?.click();'
      + '})()');
    await waitForBrowser(client,
      '!!document.querySelector(".editor-composition-panel .screen-order-v2-list-view")?.getClientRects().length',
      'beginner composition list is the visible task');
  };

  const verifyDesktop = (m, width, open) => {
    assert(m && m.density !== 'compact' && m.columns === 2,
      'desktop must have only two layout tracks: ' + JSON.stringify({ width, m }));
    assert(m.open === open && m.contentWidth === 390 && m.previewCount === 1,
      'one live 390px page and correct task state: ' + JSON.stringify({ width, m }));
    assert(m.work?.width >= 400 && m.work.width <= 590 && m.preview?.left >= m.work.right - 2,
      'readable task pane must not overlap the result: ' + JSON.stringify({ width, m }));
    assert(m.frame?.left >= m.work.right + 6 && m.frame.right <= width + 3,
      'phone must remain unobstructed to the right: ' + JSON.stringify({ width, m }));
    assert(m.overflow <= 3, 'editor must not overflow horizontally: ' + JSON.stringify({ width, m }));
    assert(m.listShown !== open && m.inspectorShown === open,
      'list and editor must REPLACE each other, never stack: ' + JSON.stringify({ width, m }));
  };

  await setViewport(client, 1672, 941, false);
  await showList();
  await waitForBrowser(client, 'document.querySelector(".phone-frame .landing-page")?.clientWidth === 390',
    'first page preview keeps its real mobile width');
  const entry = await read();
  verifyDesktop(entry, 1672, false);
  assert(entry.listFont >= 16 && entry.addHeight >= 48,
    'first screen must have readable block names and one large add button: ' + JSON.stringify(entry));
  assert(!await evaluate(client, '!!document.querySelector(".editor-composition-hint")'),
    'redundant instructions must not compete with the editable page');
  await capture(client, 'beginner-block-list-1672');
  const initialPhoneX = entry.frame.left;

  await clickPointer(client, '#editor-block-editor-hero .screen-order-v2-head');
  await waitForBrowser(client, '!!document.querySelector("#editor-block-settings-editor-hero")',
    'clicking a block opens its existing editor without another page');
  const chosen = await read();
  verifyDesktop(chosen, 1672, true);
  assert(Math.abs(chosen.frame.left - initialPhoneX) <= 4,
    'the page must not jump when switching to the selected editor');
  assert(await evaluate(client,
    'document.querySelectorAll("#editor-block-settings-editor-hero").length === 1'),
    'selected block may only mount one existing editor');
  await capture(client, 'beginner-hero-content-1672');

  await clickPointer(client, '.editor-workbench-close-inspector');
  await waitForBrowser(client,
    'document.querySelector(".edit-layout")?.dataset.inspectorOpen === "false"'
      + ' && !!document.querySelector(".editor-composition-panel")?.getClientRects().length',
    'back to list restores the visible task');
  const returned = await read();
  verifyDesktop(returned, 1672, false);
  assert(Math.abs(returned.frame.left - initialPhoneX) <= 4,
    'back to list must not move the preview');

  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client, '!!document.querySelector("#editor-block-settings-editor-text")',
    'text editor must open its original draft-bound fields');
  const textTask = await evaluate(client, '(() => {'
    + ' const panel=document.querySelector("#editor-block-settings-editor-text");'
    + ' const flow=panel?.querySelector("[data-editor-task=text]");'
    + ' const design=flow?.querySelector(".editor-quick-design");'
    + ' const children=[...(flow?.children||[])];'
    + ' return { title:!!panel?.querySelector("[placeholder=\\"제목을 입력하세요\\"]"),'
    + ' body:!!panel?.querySelector("[placeholder=\\"본문 내용을 입력하세요\\"]"),'
    + ' folded:design?.open===false, designIndex:children.indexOf(design),'
    + ' contentBeforeDesign:children.indexOf(design)>=2,'
    + ' inputFont:parseFloat(getComputedStyle(panel.querySelector("textarea")).fontSize) };'
    + '})()');
  assert(textTask?.title && textTask.body && textTask.folded
    && textTask.contentBeforeDesign && textTask.inputFont >= 16,
    'text and body must appear before optional design cards: ' + JSON.stringify(textTask));
  await capture(client, 'beginner-text-content-before-design-1672');

  // A preview-side form button shortcut must focus the matching original
  // submit text field, never submit or create a second editing state.
  await showList();
  await clickPointer(client, '#editor-block-editor-form .screen-order-v2-head');
  await waitForBrowser(client,
    '!!document.querySelector(".phone-frame #block-editor-form .editor-preview-submit-edit")',
    'selected form exposes one preview-side submit-copy shortcut');
  await clickPointer(client, '.phone-frame #block-editor-form .editor-preview-submit-edit');
  await waitForBrowser(client,
    'document.activeElement === document.querySelector("#editor-block-settings-editor-form .form-submit-task .field-title input")',
    'form submit-copy shortcut focuses exact existing field');
  assert(apiState.saveCount === 0,
    'preview form shortcut changes focus only, never submits a lead or publishes');

  // Page-wide controls still exist, but do not fill the default list screen.
  await showList();
  await clickPointer(client, '.editor-page-more > summary');
  await waitForBrowser(client, 'document.querySelector(".editor-page-more")?.open === true',
    'global settings expand on explicit request');
  await clickPointer(client, '.editor-page-more-actions button:first-child');
  await waitForBrowser(client, '!!document.querySelector(".editor-properties-panel .style-panel")',
    'whole-page design remains reachable through the secondary menu');
  assert((await read()).inspectorShown, 'page-wide design must use the same one task pane');
  await capture(client, 'beginner-page-design-optional-1672');

  for (const width of [1440, 1024, 900]) {
    await setViewport(client, width, 941, false);
    await showList();
    const listState = await read();
    verifyDesktop(listState, width, false);
    assert(listState.listFont >= 16, 'list label size must remain legible at ' + width);
    await capture(client, 'beginner-list-' + width);
    await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
    await waitForBrowser(client, '!!document.querySelector("#editor-block-settings-editor-text")',
      'selected editor remains reachable at ' + width);
    const editingState = await read();
    verifyDesktop(editingState, width, true);
    assert(Math.abs(editingState.frame.left - listState.frame.left) <= 4,
      'opening the editor must not reposition the 390px page at ' + width);
    await capture(client, 'beginner-edit-' + width);
  }

  // Fine-pointer browser zoom or a genuinely compact desktop cannot fit two
  // readable panes. Preserve the existing page/blocks/edit task selector.
  await setViewport(client, 673, 941, false);
  await waitForBrowser(client,
    'document.querySelector(".edit-layout")?.dataset.editorDensity === "compact"',
    'zoomed editor switches to compact task mode');
  await evaluate(client,
    'document.querySelector(".editor-workflow-compact-switch button:first-child")?.click()');
  await waitForBrowser(client,
    'document.querySelector(".edit-layout")?.dataset.compactView === "page"'
      + ' && document.querySelector(".phone-frame .landing-page")?.clientWidth === 390',
    'zoomed editor still exposes the unscaled real page');
  await capture(client, 'beginner-compact-page-673');
  await showList();
  await clickPointer(client, '#editor-block-editor-text .screen-order-v2-head');
  await waitForBrowser(client,
    'document.querySelector(".edit-layout")?.dataset.compactView === "edit"'
      + ' && !!document.querySelector("#editor-block-settings-editor-text")',
    'compact selection reveals only editable content');
  await capture(client, 'beginner-compact-edit-673');
  await evaluate(client, 'document.querySelector(".editor-workflow-compact-switch button:first-child")?.click()');
  await waitForBrowser(client,
    'document.querySelector(".edit-layout")?.dataset.compactView === "page"',
    'compact users can return to the real page');
  assert(apiState.saveCount === 0,
    'switching tasks and opening styles must never save or publish');
  await setViewport(client, 1280, 900, false);
}
