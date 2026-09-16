import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const timerEditor = await readFile('src/editor/blockEditors/TimerEditor.jsx', 'utf8');
const timerBasic = await readFile('src/editor/blockEditors/TimerBasicSection.jsx', 'utf8');
const timerCss = await readFile('src/editor/blockEditors/TimerEditor.css', 'utf8');
const timerVariantCss = await readFile('src/editor/blockEditors/TimerVariantOptions.css', 'utf8');
const timerRuntimeVariantCss = await readFile('src/styles/preview-workspace-timer-extra-variants.css', 'utf8');
const landingRendererCss = await readFile('src/preview/LandingRenderer.css', 'utf8');
const blockEditor = await readFile('src/editor/BlockEditor.jsx', 'utf8');
const signalBlocks = await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8');
const pageModel = await readFile('src/lib/pageModel.js', 'utf8');

for (const tab of [
  "id: 'basic'",
  "label: '기본'",
  "id: 'design'",
  "label: '디자인'",
  "id: 'bottom'",
  "label: '하단 고정'",
]) {
  assert(timerEditor.includes(tab), `Timer editor workflow missing ${tab}`);
}

assert(timerEditor.includes('<TimerContentSection s={s} set={set} />'), 'Basic timer tab must own copy and deadline settings');
assert(timerEditor.includes('<TimerDesignSection s={s} set={set} />'), 'Design timer tab must own styles and effects');
assert(timerEditor.includes('<TimerBottomSection s={s} page={page} updateBlock={updateBlock} />'), 'Bottom timer tab must receive the page and updater');
assert(timerEditor.includes("page?.blocks?.find((block) => block?.type === 'bottombar')"), 'Bottom timer workflow must resolve the actual bottom bar block');
assert(timerEditor.includes('updateBlock(bottomBlock.id, { timerEnabled: checked })'), 'Bottom timer toggle must update only the bottom bar timer flag');
assert(timerEditor.includes('disabled={!bottomBlock'), 'Bottom timer toggle must be disabled when no bottom bar exists');
assert(timerEditor.includes("line: '라인'") && timerEditor.includes("point: '포인트'"), 'Bottom timer preview must label line and point styles');
assert(blockEditor.includes('const props = { s, set, page, updateBlock,'), 'BlockEditor must expose the guarded block updater to timer workflow');

const variantValues = [...timerBasic.matchAll(/\{ value: '(minimal|flat|block|line|point)', label:/g)].map((match) => match[1]);
assert(JSON.stringify(variantValues) === JSON.stringify(['minimal', 'flat', 'block', 'line', 'point']), 'Timer editor must expose exactly five saved timer styles');
assert(timerBasic.includes("option.value === 'line'") && timerBasic.includes("option.value === 'point'"), 'Timer editor must render previews for line and point styles');
assert(!timerBasic.includes("line: 'minimal'") && !timerBasic.includes("point: 'flat'"), 'Line and point styles must not collapse back to legacy aliases');

const effectValues = [...timerBasic.matchAll(/\{ value: '(none|slide|flip|pulse|fire)', label:/g)].map((match) => match[1]);
assert(JSON.stringify(effectValues) === JSON.stringify(['none', 'slide', 'flip', 'pulse', 'fire']), 'Timer editor must expose exactly five explicit motion effects');

assert(timerBasic.includes("value={s.label ?? '혜택 마감까지'}"), 'Timer copy must remain directly editable');
assert(timerBasic.includes("value={s.promoBadge ?? '마감 임박'}"), 'Promotion badge must remain directly editable');
assert(timerBasic.includes("value={s.ended ?? '종료되었습니다.'}"), 'Timer ended copy must be directly editable');
assert(timerBasic.includes('className={`timer-workflow-choice is-${kind} choice-${option.value}`}'), 'Style and effect choices must use visual preview cards');
assert(timerBasic.includes("timerMotion: next !== 'none'"), 'Legacy timer motion compatibility must remain synchronized');

for (const selector of [
  '.timer-workflow-choice-grid',
  '.timer-workflow-palette-grid',
  '.timer-bottom-link-preview',
  '.choice-slide',
  '.choice-flip',
  '.choice-pulse',
  '.choice-fire',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert(timerCss.includes(selector), `Timer editor visual workflow CSS missing ${selector}`);
}

for (const selector of [
  '.timer-workflow-choice.choice-line',
  '.timer-workflow-choice.choice-point',
  '.timer-bottom-mini-line',
  '.timer-bottom-mini-point',
]) {
  assert(timerVariantCss.includes(selector), `Timer variant option CSS missing ${selector}`);
}
assert(!timerVariantCss.includes('gradient('), 'New timer editor style previews must stay gradient-free');

assert(landingRendererCss.includes("@import '../styles/preview-workspace-timer-extra-variants.css';"), 'Landing renderer must load the line and point timer runtime styles');
for (const selector of [
  '.landing-section.timer.timer-variant-line',
  '.landing-section.timer.timer-variant-point',
  '.bottom-bar .bottom-timer-variant-line',
  '.bottom-bar .bottom-timer-variant-point',
]) {
  assert(timerRuntimeVariantCss.includes(selector), `Timer runtime variant CSS missing ${selector}`);
}
assert(!timerRuntimeVariantCss.includes('gradient('), 'New line and point runtime timer styles must stay gradient-free');

assert(signalBlocks.includes("const TIMER_VARIANTS = ['clean', 'cards', 'promo', 'line', 'point']"), 'Public timer renderer must keep five canonical variants');
assert(signalBlocks.includes("line: 'line'") && signalBlocks.includes("point: 'point'"), 'Public timer renderer must preserve line and point variants');
assert(signalBlocks.includes("const TIMER_EFFECTS = ['none', 'slide', 'flip', 'pulse', 'fire']"), 'Public timer renderer must keep the five selected effects');
assert(signalBlocks.includes("const target = settings.endAt || settings.timerEndAt"), 'Timer workflow must not alter countdown target calculation');
assert(signalBlocks.includes("<strong className=\"timer-ended\">{s.ended || '종료되었습니다.'}</strong>"), 'Public timer must consume the editable ended copy');
assert(pageModel.includes("timerVariant: ['minimal','flat','block','line','point']"), 'Page model style schema must allow all five timer variants');
assert(pageModel.includes("['minimal','flat','block','line','point']"), 'Page normalization must preserve all five timer variants after save and reload');

assert(signalBlocks.includes("import { useEffect, useState, useSyncExternalStore } from 'react';"), 'Countdowns must use the shared React external store clock');
assert(signalBlocks.includes('const COUNTDOWN_CLOCK_SUBSCRIBERS = new Set();'), 'Countdown clock must keep one shared subscriber registry');
assert(signalBlocks.includes('countdownClockInterval = globalThis.setInterval(emitCountdownClockTick, 1000);'), 'Countdown clock must start exactly one shared one-second interval');
assert(signalBlocks.includes('if (COUNTDOWN_CLOCK_SUBSCRIBERS.size === 1) startCountdownClock();'), 'The shared clock must start only for the first timer subscriber');
assert(signalBlocks.includes('if (COUNTDOWN_CLOCK_SUBSCRIBERS.size === 0) stopCountdownClock();'), 'The shared clock must stop when the final timer unmounts');
assert(signalBlocks.includes('const second = useSyncExternalStore('), 'Every countdown must subscribe to the same second snapshot');
assert(signalBlocks.includes('const now = useCountdownClock();') && signalBlocks.includes('const data = getTimerTarget(settings, now);'), 'Countdown calculation must consume the shared timestamp');
assert(signalBlocks.includes('data-timer-tick={tickKey}'), 'Main and fixed timers must expose the same tick contract for browser verification');
assert(!signalBlocks.includes('const [now, setNow] = useState(Date.now())'), 'Countdown hooks must not allocate per-component clock state');
assert(!signalBlocks.includes('setInterval(() => setNow(Date.now()), 1000)'), 'Countdown hooks must not create one interval per timer');

console.log(JSON.stringify({
  ok: true,
  check: 'timer-settings-workflow',
  tabs: 3,
  styles: variantValues.length,
  effects: effectValues.length,
  bottomTimerIntegrated: true,
  lineAndPointPersisted: true,
  newVariantGradients: false,
  sharedCountdownClock: true,
  countdownIntervalsPerRuntime: 1,
  stopsWithoutSubscribers: true,
}, null, 2));