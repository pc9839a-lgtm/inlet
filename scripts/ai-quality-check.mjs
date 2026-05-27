import { readFile } from 'node:fs/promises';
import { validateAiDraftJson } from '../src/ai/aiDraftSchema.js';
import { aiDraftToBlocks, applyAiDraftToPage } from '../src/ai/aiDraftApply.js';

const LIVE_SKIPPED = 'skipped-live';

function liveQaError(kind, message) {
  return new Error(`live AI ${kind}: ${message}`);
}

function classifyLiveHttpError(status, body) {
  const text = String(body || '');
  if ([401, 403].includes(Number(status)) || /OPENAI_API_KEY|api key|unauthorized|forbidden/i.test(text)) {
    return 'missing-key';
  }
  return 'request-failed';
}

function summarizeStatuses(items = []) {
  return items.reduce((summary, item) => {
    const status = item.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
}

const sampleInputs = [
  {
    name: 'skin-booking',
    prompt: '부평 피부관리샵 첫 방문 예약 랜딩. 민감성 피부 상담, 카카오 문의, 예약폼이 필요해.',
    industry: '피부관리샵',
    goal: '방문예약',
    contactMethod: '방문예약',
    sections: ['hero', 'benefit', 'reservation', 'links', 'faq'],
    expect: { blocks: ['hero', 'reservation', 'links'], actionTargets: ['reservation'], keywords: ['피부', '예약'] },
  },
  {
    name: 'tax-trust',
    prompt: '소상공인 세무 상담 랜딩. 무료 진단보다 신뢰와 절차 안내가 중요해.',
    industry: '세무 상담',
    goal: '상담신청',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    expect: { blocks: ['hero', 'form', 'faq'], actionTargets: ['form'], keywords: ['세무', '상담'] },
  },
  {
    name: 'insurance-quote',
    prompt: '40대 가족 보험 리모델링 견적문의 랜딩. 과장 보장 말고 현재 가입 내역 확인 중심.',
    industry: '보험 리모델링',
    goal: '견적문의',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    expect: { blocks: ['hero', 'form'], actionTargets: ['form'], keywords: ['보험', '가입'] },
  },
  {
    name: 'academy-event',
    prompt: '초등 영어학원 겨울방학 레벨테스트 신청 페이지. 학부모가 일정과 수업 방식을 빨리 이해해야 해.',
    industry: '영어학원',
    goal: '이벤트 신청',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'timer', 'links', 'form', 'faq'],
    expect: { blocks: ['hero', 'timer', 'form'], actionTargets: ['form'], keywords: ['영어', '레벨'] },
  },
  {
    name: 'dental-visit',
    prompt: '동네 치과 임플란트 상담 예약 랜딩. 가격 확정보다는 검사와 상담 절차를 강조.',
    industry: '치과',
    goal: '방문예약',
    contactMethod: '방문예약',
    sections: ['hero', 'benefit', 'reservation', 'links', 'map', 'faq'],
    expect: { blocks: ['hero', 'reservation', 'faq'], actionTargets: ['reservation'], keywords: ['치과', '상담'] },
  },
  {
    name: 'fitness-consult',
    prompt: '여성 PT 체형관리 상담 랜딩. 무리한 감량 보장 금지, 현재 운동 경험과 목표 확인.',
    industry: '퍼스널트레이닝',
    goal: '상담신청',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'links', 'form', 'activity'],
    expect: { blocks: ['hero', 'form'], actionTargets: ['form'], keywords: ['운동', '목표'] },
  },
  {
    name: 'moving-quote',
    prompt: '원룸 이사 견적 문의 랜딩. 이사 날짜, 출발/도착 지역, 짐 규모를 쉽게 받는 게 핵심.',
    industry: '이사 견적',
    goal: '견적문의',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    expect: { blocks: ['hero', 'form'], actionTargets: ['form'], keywords: ['이사', '견적'] },
  },
  {
    name: 'restaurant-reservation',
    prompt: '오마카세 식당 예약 랜딩. 좌석 수가 적고 예약 가능 시간을 먼저 보여주고 싶어.',
    industry: '오마카세',
    goal: '방문예약',
    contactMethod: '방문예약',
    sections: ['hero', 'benefit', 'reservation', 'links', 'map'],
    expect: { blocks: ['hero', 'reservation'], actionTargets: ['reservation'], keywords: ['예약', '좌석'] },
  },
  {
    name: 'b2b-saas-demo',
    prompt: 'B2B 재고관리 SaaS 데모 신청 랜딩. 담당자에게 현재 재고관리 방식과 도입 규모를 물어야 해.',
    industry: '재고관리 SaaS',
    goal: '상품문의',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    expect: { blocks: ['hero', 'form', 'faq'], actionTargets: ['form'], keywords: ['재고', '도입'] },
  },
  {
    name: 'wedding-consult',
    prompt: '웨딩 스냅 촬영 상담 랜딩. 촬영일, 장소, 원하는 분위기를 먼저 받는 구성.',
    industry: '웨딩 스냅',
    goal: '상담신청',
    contactMethod: '상담폼',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    expect: { blocks: ['hero', 'form'], actionTargets: ['form'], keywords: ['촬영', '웨딩'] },
  },
];

const fixtureDraft = {
  pageTitle: '피부관리 첫 방문 상담',
  brandName: '스킨케어',
  templateStyle: 'booking',
  qualityNote: '민감성 피부 고객이 첫 방문 전 확인해야 할 기준과 예약 행동을 연결합니다.',
  primaryAction: { label: '예약 가능 시간 보기', target: 'reservation', url: '' },
  theme: {
    accentColor: '#2563eb',
    bgMode: 'gradient',
    bgColor: '#F5F7FA',
    gradientFrom: '#F8FAFC',
    gradientTo: '#DBEAFE',
    cardColor: '#FFFFFF',
    textColor: '#111827',
    radius: 24,
    buttonEffect: 'shine',
    animation: 'rise',
  },
  blocks: [
    { type: 'hero', title: '민감성 피부 첫 방문 상담', body: '피부 상태와 생활 패턴을 먼저 확인한 뒤 필요한 관리 방향을 안내합니다.', align: 'left', height: 'medium', titleSize: 'large' },
    { type: 'text', title: '상담 전 확인 기준', body: '최근 트러블, 건조감, 시술 경험을 기준으로 무리한 관리보다 현재 피부에 맞는 선택지를 정리합니다.', layout: 'card', align: 'left', size: 'medium' },
    { type: 'text', title: '첫 방문 흐름', body: '예약 후 피부 고민을 남기면 방문 시 상담 항목을 미리 준비해 대기와 반복 설명을 줄입니다.', layout: 'notice', align: 'left', size: 'medium' },
    { type: 'reservation', title: '방문 예약', desc: '희망 시간을 선택하면 확인 후 안내드립니다.', weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '10:00', end: '18:00', interval: 30, customFields: [{ label: '피부 고민', type: 'long', required: false }] },
    { type: 'links', title: '예약 전 확인', layout: 'card', items: [{ label: '예약 문의 남기기', target: 'reservation', url: '', emoji: '📅', iconMode: 'emoji' }] },
    { type: 'faq', title: '자주 묻는 질문', layout: 'accordion', items: [{ q: '민감성 피부도 상담 가능한가요?', a: '방문 전 현재 피부 상태와 피해야 할 성분을 먼저 확인한 뒤 안내합니다.' }] },
  ],
};

const editableBasePage = {
  title: 'QA base',
  theme: {},
  blocks: [
    { id: 'topnav', type: 'topnav', visible: true, s: { logoText: 'QA', menus: [] } },
    { id: 'old-hero', type: 'hero', visible: true, s: { title: 'old', body: 'old' } },
    { id: 'bottom', type: 'bottombar', visible: true, s: { count: 1, buttons: [] } },
    { id: 'footer', type: 'footer', visible: true, s: { company: 'QA', owner: '', phone: '', address: '' } },
  ],
};

function textBlob(draft = {}) {
  return JSON.stringify({
    pageTitle: draft.pageTitle,
    brandName: draft.brandName,
    qualityNote: draft.qualityNote,
    primaryAction: draft.primaryAction,
    blocks: draft.blocks,
  });
}

function assertExpected(draft, label, expect = {}) {
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  const types = blocks.map((block) => block.type);
  const text = textBlob(draft);
  const compact = text.replace(/\s+/g, '');
  const genericPhrases = ['고객맞춤', '빠른문의', '문의해주세요', '정보를남겨주시면', '확인후연락'];
  const genericHit = genericPhrases.find((phrase) => compact.includes(phrase));
  if (genericHit) throw new Error(`${label}: 일반 문구가 남아 있습니다: ${genericHit}`);

  for (const type of expect.blocks || []) {
    if (!types.includes(type)) throw new Error(`${label}: 필수 블록 누락: ${type}`);
  }

  if (expect.actionTargets?.length && !expect.actionTargets.includes(draft.primaryAction?.target)) {
    throw new Error(`${label}: CTA target 불일치: ${draft.primaryAction?.target || 'none'}`);
  }

  const keywordHits = (expect.keywords || []).filter((keyword) => text.includes(keyword));
  if ((expect.keywords || []).length && keywordHits.length < 1) {
    throw new Error(`${label}: 기대 키워드 반영 부족: ${(expect.keywords || []).join(', ')}`);
  }
}

function assertDraft(draft, label, expect = {}) {
  const check = validateAiDraftJson(draft);
  if (!check.ok) throw new Error(`${label}: ${check.message}`);
  const editableBlocks = aiDraftToBlocks(draft);
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  const hero = blocks.find((block) => block.type === 'hero');
  const action = draft.primaryAction || {};
  if (!hero?.title || !hero?.body) throw new Error(`${label}: hero 제목/본문이 부족합니다.`);
  if (!action.label || !action.target) throw new Error(`${label}: primaryAction이 부족합니다.`);
  if (!blocks.some((block) => ['form', 'reservation', 'links'].includes(block.type))) {
    throw new Error(`${label}: 전환 행동 블록이 없습니다.`);
  }
  if (editableBlocks.some((block) => !block.id || !block.type || !block.s || typeof block.s !== 'object')) {
    throw new Error(`${label}: 편집 가능한 페이지 블록으로 변환되지 않았습니다.`);
  }
  const applied = applyAiDraftToPage(editableBasePage, draft, { mode: 'replace', updateTheme: true, updateFixed: true });
  if (!Array.isArray(applied.blocks) || applied.blocks.length < editableBlocks.length) {
    throw new Error(`${label}: AI 초안 적용 후 페이지 블록이 부족합니다.`);
  }
  const appliedEditable = applied.blocks.filter((block) => !['topnav', 'bottombar', 'footer'].includes(block.type));
  if (appliedEditable.some((block) => !block.s || typeof block.s !== 'object')) {
    throw new Error(`${label}: 적용된 블록에 편집 설정 s가 없습니다.`);
  }
  assertExpected(draft, label, expect);
  return { label, blocks: blocks.length, editableBlocks: editableBlocks.length, title: draft.pageTitle, action: `${action.label}:${action.target}` };
}

async function loadDraftFile() {
  const file = process.env.AI_QA_DRAFT_FILE;
  if (!file) return null;
  return JSON.parse(await readFile(file, 'utf8'));
}

async function liveDrafts() {
  if (process.env.INLET_AI_QA_LIVE !== '1') {
    return {
      checks: [],
      status: {
        status: LIVE_SKIPPED,
        reason: 'INLET_AI_QA_LIVE is not 1',
      },
    };
  }

  const explicitEndpoint = String(process.env.INLET_AI_QA_ENDPOINT || '').trim();
  const hasOpenAiKey = Boolean(String(process.env.OPENAI_API_KEY || '').trim());
  if (!explicitEndpoint && !hasOpenAiKey) {
    return {
      checks: [],
      status: {
        status: LIVE_SKIPPED,
        reason: 'OPENAI_API_KEY or INLET_AI_QA_ENDPOINT is required for live AI QA',
      },
    };
  }

  const base = String(explicitEndpoint || process.env.VITE_API_BASE_URL || 'http://localhost:8787').replace(/\/+$/, '');
  const model = process.env.INLET_AI_QA_MODEL || 'gpt-4.1-mini';
  const limit = Math.max(1, Math.min(sampleInputs.length, Number(process.env.INLET_AI_QA_LIMIT || sampleInputs.length)));
  const results = [];

  for (const input of sampleInputs.slice(0, limit)) {
    const { expect, name, ...payloadInput } = input;
    let res;
    try {
      res = await fetch(`${base}/api/ai/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: payloadInput }),
      });
    } catch (error) {
      throw liveQaError('server-unreachable', `${base}/api/ai/draft is not reachable. Start the server or set INLET_AI_QA_ENDPOINT. ${error?.message || error}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw liveQaError(classifyLiveHttpError(res.status, body), `${input.industry}: ${res.status} ${body}`);
    }
    let data;
    try {
      data = await res.json();
    } catch (error) {
      throw liveQaError('bad-model-response', `response was not valid JSON. ${error?.message || error}`);
    }
    results.push([`live:${name || input.industry}`, data.draft || data, expect]);
  }

  return {
    checks: results,
    status: {
      status: 'pass',
      endpoint: base,
      samples: results.length,
    },
  };
}

const checks = [['fixture', fixtureDraft, { blocks: ['hero', 'reservation', 'links'], actionTargets: ['reservation'], keywords: ['피부', '예약'] }]];
const draftFile = await loadDraftFile();
if (draftFile) checks.push(['file', draftFile]);
const live = await liveDrafts();
checks.push(...live.checks);

const reports = [];
for (const [label, draft, expect] of checks) {
  try {
    reports.push(assertDraft(draft, label, expect));
  } catch (error) {
    if (String(label).startsWith('live:')) {
      throw liveQaError('bad-model-response', error?.message || error);
    }
    throw error;
  }
}
console.log(JSON.stringify({
  ok: true,
  samples: sampleInputs.length,
  live: live.status,
  liveSummary: summarizeStatuses([live.status]),
  liveFailureKinds: ['skipped-live', 'server-unreachable', 'missing-key', 'request-failed', 'bad-model-response'],
  reports,
}, null, 2));
