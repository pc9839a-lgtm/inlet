export const AI_ALIAS_BLOCK_TYPES = ['benefit'];

export const AI_ALLOWED_BLOCK_TYPES = [
  'hero',
  'text',
  'image',
  'map',
  'faq',
  'links',
  'timer',
  'activity',
  'spacer',
  'divider',
  'form',
  'reservation',
];

export const AI_DRAFT_REQUIRED_FIELDS = [
  ['industry', '업종/키워드'],
];

export const AI_TONE_OPTIONS = [
  ['simple', '심플'],
  ['premium', '고급'],
  ['friendly', '친근'],
  ['professional', '전문'],
  ['strong_cta', '강한 CTA'],
];

export const AI_TEMPLATE_OPTIONS = [
  ['auto', '자동 다양화'],
  ['trust', '신뢰형'],
  ['promo', '프로모션형'],
  ['booking', '예약전환형'],
  ['story', '스토리형'],
  ['compare', '비교설득형'],
];

export const AI_APPLY_MODE_OPTIONS = [
  ['replace', '전체 교체'],
  ['append', '아래에 추가'],
];

export const AI_GOAL_OPTIONS = [
  ['상담신청', '상담신청'],
  ['방문예약', '방문예약'],
  ['견적문의', '견적문의'],
  ['이벤트 신청', '이벤트 신청'],
  ['상품문의', '상품문의'],
];

export const AI_CONTACT_OPTIONS = [
  ['상담폼', '상담 폼'],
  ['방문예약', '방문 예약'],
  ['전화', '전화'],
  ['카카오톡', '카카오톡'],
  ['상담폼+전화', '상담 폼 + 전화'],
];

export const AI_SECTION_OPTIONS = [
  ['hero', '히어로'],
  ['benefit', '혜택'],
  ['links', '문의 링크'],
  ['map', '지도'],
  ['timer', '타이머'],
  ['activity', '실시간 접수'],
  ['form', '상담 폼'],
  ['reservation', '방문 예약'],
  ['faq', 'FAQ'],
];

export const EMPTY_AI_DRAFT_INPUT = {
  inputMode: 'simple',
  prompt: '',
  industry: '',
  serviceName: '',
  goal: '상담신청',
  benefit: '',
  cta: '상담 신청하기',
  contactMethod: '상담폼',
  targetCustomer: '',
  tone: 'premium',
  templateStyle: 'auto',
  keyMessage: '',
  avoidWords: '',
  sections: ['hero', 'benefit', 'links', 'form'],
};

export function normalizeAiDraftInput(input = {}) {
  const allowedSectionKeys = AI_SECTION_OPTIONS.map(([key]) => key);
  const allowedTemplateKeys = AI_TEMPLATE_OPTIONS.map(([key]) => key);
  const sections = Array.isArray(input.sections) && input.sections.length
    ? input.sections.filter((key) => allowedSectionKeys.includes(key))
    : EMPTY_AI_DRAFT_INPUT.sections;

  return {
    ...EMPTY_AI_DRAFT_INPUT,
    ...input,
    inputMode: ['simple', 'detail'].includes(input.inputMode) ? input.inputMode : EMPTY_AI_DRAFT_INPUT.inputMode,
    prompt: String(input.prompt || '').trim(),
    sections: sections.length ? sections : EMPTY_AI_DRAFT_INPUT.sections,
    templateStyle: allowedTemplateKeys.includes(input.templateStyle) ? input.templateStyle : EMPTY_AI_DRAFT_INPUT.templateStyle,
    creativeSeed: String(input.creativeSeed || '').trim(),
  };
}

export function validateAiDraftJson(data) {
  if (!data || typeof data !== 'object') return { ok: false, message: 'JSON 객체가 아닙니다.' };
  if (!Array.isArray(data.blocks)) return { ok: false, message: 'blocks 배열이 없습니다.' };
  if (data.blocks.length < 4) return { ok: false, message: '블록이 너무 적습니다. 4개 이상으로 다시 생성해주세요.' };
  if (data.blocks.length > 12) return { ok: false, message: '블록이 너무 많습니다. 12개 이하로 생성해주세요.' };

  const validTypes = [...AI_ALLOWED_BLOCK_TYPES, ...AI_ALIAS_BLOCK_TYPES];
  const invalid = data.blocks.find((block) => !validTypes.includes(block?.type));
  if (invalid) return { ok: false, message: `지원하지 않는 블록 타입입니다: ${invalid?.type || 'unknown'}` };

  const emptyImage = data.blocks.find((block) => block?.type === 'image' && !block.image && !block.url && !block.src && !(Array.isArray(block.gallery) && block.gallery.length));
  if (emptyImage) return { ok: false, message: '이미지 블록에는 실제 이미지가 필요합니다. 이미지를 쓰지 않거나 실제 이미지 URL을 넣어 다시 생성해주세요.' };

  const badLink = data.blocks.find((block) => block?.type === 'links' && Array.isArray(block.items) && block.items.some((item) => {
    if (item?.target === 'phone') return !/^tel:\d[\d-]+$/i.test(String(item.url || '').trim());
    if (item?.target === 'url') return !/^https?:\/\//i.test(String(item.url || '').trim());
    return false;
  }));
  if (badLink) return { ok: false, message: '전화 또는 외부 링크는 실제 연결 주소가 필요합니다. 전화번호/URL을 입력하거나 해당 링크를 제외해주세요.' };

  const form = data.blocks.find((block) => block?.type === 'form');
  if (form && Array.isArray(form.questions)) {
    const meaningful = form.questions.filter((question) => !['name', 'phone', 'email'].includes(question?.type)).length;
    if (form.questions.length < 3 || meaningful < 1) return { ok: false, message: '상담 폼에는 업종에 맞는 추가 질문이 필요합니다. 이름/연락처 외에 상담 내용, 희망 일정, 관심 항목 중 하나 이상을 넣어주세요.' };
  }

  return { ok: true, message: '정상' };
}
