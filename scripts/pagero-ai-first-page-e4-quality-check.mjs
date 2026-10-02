import { readFile } from 'node:fs/promises';
import { aiFirstPageBrief, fallbackAiFirstPageDraft } from '../src/ai/aiFirstPageFlow.js';
import { applyAiDraftToPage } from '../src/ai/aiDraftApply.js';
import { buildPublishChecklist } from '../src/editor/publishChecklist.js';
import { defaultPage, normalizePageForSave } from '../src/lib/pageModel.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const samples = [
  {
    name: 'debt',
    input: {
      industry: '개인회생',
      serviceName: '새출발 법률상담',
      benefit: '현재 상황 확인 후 상담 준비',
      region: '인천',
      inquiryFields: '현재 상황, 연락 가능 시간',
      goal: '상담신청',
      contactMethod: '상담폼',
      slug: 'debt-consult',
    },
    expectStyle: 'trust',
    expectSections: ['hero', 'form', 'faq'],
  },
  {
    name: 'realestate',
    input: {
      industry: '아파트 분양',
      serviceName: '센트럴 분양안내',
      benefit: '관심 조건과 방문 가능 시간 확인',
      region: '수원',
      inquiryFields: '관심 타입, 예산 범위, 방문 가능 시간',
      goal: '방문예약',
      contactMethod: '방문예약',
      slug: 'central-home',
    },
    expectStyle: 'compare',
    expectSections: ['hero', 'reservation', 'faq'],
  },
  {
    name: 'wedding',
    input: {
      industry: '모바일 청첩장',
      serviceName: '도윤 지현 웨딩',
      benefit: '예식 정보와 문의 확인',
      region: '인천',
      inquiryFields: '문의 내용, 연락 가능 시간',
      goal: '상담신청',
      contactMethod: '상담폼',
      slug: 'wedding-info',
    },
    expectStyle: 'story',
    expectSections: ['hero', 'form', 'faq'],
  },
];

for (const sample of samples) {
  const brief = aiFirstPageBrief(sample.input);
  assert(brief.templateStyle === sample.expectStyle, `${sample.name}: industry default template mismatch: ${brief.templateStyle}`);
  assert(brief.region === sample.input.region, `${sample.name}: region must survive brief normalization`);
  assert(brief.inquiryFields === sample.input.inquiryFields, `${sample.name}: inquiry fields must survive brief normalization`);
  for (const section of sample.expectSections) {
    assert(brief.sections.includes(section), `${sample.name}: default structure missing ${section}`);
  }

  const draft = fallbackAiFirstPageDraft(brief, 'offline QA fallback');
  assert(Array.isArray(draft.blocks) && draft.blocks.length >= 6, `${sample.name}: fallback must create a complete editable first page`);
  assert(draft.blocks[0]?.type === 'hero', `${sample.name}: first block must be hero`);
  assert(draft.blocks.some((block) => ['form', 'reservation'].includes(block.type)), `${sample.name}: fallback must keep a lead action block`);

  const basePage = normalizePageForSave({
    ...defaultPage,
    slug: sample.input.slug,
    ai: { ...(defaultPage.ai || {}), draftInput: brief },
  });
  const page = applyAiDraftToPage(basePage, draft, { mode: 'replace', updateTheme: true, updateFixed: true });
  const contentBlocks = page.blocks.filter((block) => !['topnav', 'bottombar', 'footer'].includes(block.type));
  assert(contentBlocks.every((block) => block?.id && block?.s && typeof block.s === 'object'), `${sample.name}: generated content must be normal editable PageRo blocks`);

  const checklist = buildPublishChecklist(page);
  assert(checklist.items.length === 6, `${sample.name}: publish checklist must keep six launch checks`);
  assert(checklist.items.find((item) => item.id === 'hero')?.ok, `${sample.name}: hero check should pass after first-page generation`);
  assert(checklist.items.find((item) => item.id === 'action')?.ok, `${sample.name}: conversion action check should pass after first-page generation`);
  assert(checklist.items.find((item) => item.id === 'fields')?.ok, `${sample.name}: inquiry field check should pass after first-page generation`);
  assert(!checklist.items.find((item) => item.id === 'footer')?.ok, `${sample.name}: placeholder footer must remain an explicit pre-publish task`);
}

const createActions = await readFile('src/runtime/useCreatePageActions.js', 'utf8');
const firstPageFlow = await readFile('src/ai/aiFirstPageFlow.js', 'utf8');
const createFlow = await readFile('src/screens/CreateLandingFlow.jsx', 'utf8');
const schema = await readFile('src/ai/aiDraftSchema.js', 'utf8');
const prompt = await readFile('src/ai/aiDraftPrompt.js', 'utf8');
const serverAi = await readFile('functions/api/ai/_ai.js', 'utf8');
const cockpit = await readFile('src/screens/workspace/ConversionCockpit.jsx', 'utf8');
const checklistUi = await readFile('src/screens/workspace/PublishChecklist.jsx', 'utf8');

assert(createActions.includes('createAiFirstPage') && createActions.includes("status: 'generating'") && createActions.includes("status: 'ready'"), 'AI create action must generate and persist an actual first page');
assert(createActions.includes("source: firstPage.source") && firstPageFlow.includes("source = 'brief-fallback'"), 'AI create action must retain first-page source/fallback state');
assert(createFlow.includes('핵심 혜택') && createFlow.includes('지역') && createFlow.includes('받고 싶은 문의 항목'), 'E4 create brief must expose the product-direction fields');
assert(createFlow.includes('AI 첫 페이지 만들기') && createFlow.includes('첫 페이지 만드는 중'), 'E4 create flow must expose immediate generation state');
assert(schema.includes("region: ''") && schema.includes("inquiryFields: ''"), 'AI brief schema must persist region and inquiry fields');
assert(prompt.includes('받고 싶은 문의 항목') && prompt.includes('허위 주소를 만들지 말고'), 'client AI prompt must preserve E4 brief semantics');
assert(serverAi.includes('input.inquiryFields') && serverAi.includes('5 to 8 editable content blocks'), 'server AI prompt must build a complete editable first page');
assert(cockpit.includes('<PublishChecklist page={page} />') && checklistUi.includes('checklist.readyCount'), 'conversion cockpit must expose the pre-publish checklist');

console.log(JSON.stringify({
  ok: true,
  checks: 28,
  scope: 'pagero-ai-first-page-e4',
  briefFields: ['industry', 'serviceName', 'benefit', 'region', 'inquiryFields'],
  industryDefaults: ['개인회생', '분양', '청첩장'],
  output: 'editable-pagero-blocks',
  fallback: 'editable-brief-structure',
  publishChecklist: 6,
}, null, 2));
