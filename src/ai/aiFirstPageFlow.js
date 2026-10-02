import { applyAiDraftToPage } from './aiDraftApply.js';
import { generateAiDraft } from './aiDraftGenerator.js';
import { normalizeAiDraftInput } from './aiDraftSchema.js';

const INDUSTRY_PRESETS = [
  {
    id: 'debt-consult',
    test: /개인회생|개인파산|채무|회생상담/i,
    templateStyle: 'trust',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    fallbackFields: ['현재 상황', '연락 가능 시간'],
  },
  {
    id: 'realestate-visit',
    test: /분양|모델하우스|아파트|오피스텔|부동산/i,
    templateStyle: 'compare',
    sections: ['hero', 'benefit', 'links', 'form', 'reservation', 'faq'],
    fallbackFields: ['관심 조건', '상담 가능 시간'],
  },
  {
    id: 'wedding-info',
    test: /청첩장|웨딩|예식|결혼식/i,
    templateStyle: 'story',
    sections: ['hero', 'benefit', 'links', 'form', 'faq'],
    fallbackFields: ['문의 내용', '연락 가능 시간'],
  },
];

const GOAL_PRESETS = {
  상담신청: { templateStyle: 'trust', sections: ['hero', 'benefit', 'links', 'form', 'faq'] },
  방문예약: { templateStyle: 'booking', sections: ['hero', 'benefit', 'reservation', 'links', 'faq'] },
  견적문의: { templateStyle: 'compare', sections: ['hero', 'benefit', 'links', 'form', 'faq'] },
  '이벤트 신청': { templateStyle: 'promo', sections: ['hero', 'benefit', 'timer', 'links', 'form'] },
  상품문의: { templateStyle: 'trust', sections: ['hero', 'benefit', 'links', 'form', 'faq'] },
};

function compact(value = '', max = 160) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function briefText(input = {}) {
  return [
    input.industry,
    input.serviceName,
    input.prompt,
    input.goal,
    input.contactMethod,
  ].filter(Boolean).join(' ');
}

function industryPreset(input = {}) {
  const text = briefText(input);
  return INDUSTRY_PRESETS.find((preset) => preset.test.test(text)) || null;
}

function uniqueSections(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function inquiryFields(input = {}, preset = null) {
  const explicit = String(input.inquiryFields || '')
    .split(/[,/|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (explicit.length) return explicit;
  return preset?.fallbackFields || ['원하는 내용', '연락 가능 시간'];
}

export function aiFirstPageBrief(input = {}) {
  const preset = industryPreset(input);
  const goalPreset = GOAL_PRESETS[input.goal] || GOAL_PRESETS.상담신청;
  const wantsReservation = input.goal === '방문예약' || input.contactMethod === '방문예약';
  const wantsForm = !wantsReservation || /상담폼/.test(String(input.contactMethod || ''));

  let sections = preset?.sections?.length ? preset.sections : goalPreset.sections;
  if (wantsReservation) sections = uniqueSections([...sections.filter((item) => item !== 'form'), 'reservation']);
  if (wantsForm && !sections.includes('form') && !wantsReservation) sections = uniqueSections([...sections, 'form']);
  if (input.goal === '이벤트 신청' && !sections.includes('timer')) sections = uniqueSections([...sections, 'timer']);

  return normalizeAiDraftInput({
    ...input,
    inputMode: 'detail',
    region: String(input.region || '').trim(),
    inquiryFields: String(input.inquiryFields || '').trim(),
    templateStyle: input.templateStyle && input.templateStyle !== 'auto'
      ? input.templateStyle
      : (preset?.templateStyle || goalPreset.templateStyle),
    sections,
    templateMeta: {
      ...(input.templateMeta || {}),
      presetId: preset?.id || 'goal-default',
      industry: input.industry || '',
      region: input.region || '',
      inquiryFields: input.inquiryFields || '',
    },
  });
}

function fallbackActionTarget(input = {}) {
  return input.goal === '방문예약' || input.contactMethod === '방문예약' ? 'reservation' : 'form';
}

function fallbackActionLabel(input = {}, target = 'form') {
  const requestedCta = String(input.cta || '').trim();
  if (requestedCta && requestedCta !== '상담 신청하기') return compact(requestedCta, 24);
  if (target === 'reservation') return '방문 예약하기';
  if (input.goal === '견적문의') return '견적 문의하기';
  if (input.goal === '이벤트 신청') return '신청하기';
  if (input.goal === '상품문의') return '상품 문의하기';
  return '상담 신청하기';
}

function fallbackTheme(style = 'trust') {
  const themes = {
    trust: { accentColor: '#1f2937', bgColor: '#F5F7FA', gradientFrom: '#F8FAFC', gradientTo: '#EAF2FF' },
    compare: { accentColor: '#7c3aed', bgColor: '#F8FAFC', gradientFrom: '#F8FAFC', gradientTo: '#EDE9FE' },
    booking: { accentColor: '#2563eb', bgColor: '#F5F7FA', gradientFrom: '#F8FAFC', gradientTo: '#DBEAFE' },
    promo: { accentColor: '#ef4444', bgColor: '#FFF7ED', gradientFrom: '#FFF7ED', gradientTo: '#FFE4E6' },
    story: { accentColor: '#0f766e', bgColor: '#F3FAF8', gradientFrom: '#F3FAF8', gradientTo: '#E0F2FE' },
  };
  const theme = themes[style] || themes.trust;
  return {
    tone: 'professional',
    ...theme,
    bgMode: 'gradient',
    cardColor: '#FFFFFF',
    textColor: '#111827',
    radius: 24,
    buttonEffect: 'fill',
    animation: 'rise',
  };
}

export function fallbackAiFirstPageDraft(rawInput = {}, warning = '') {
  const input = aiFirstPageBrief(rawInput);
  const preset = industryPreset(input);
  const target = fallbackActionTarget(input);
  const actionLabel = fallbackActionLabel(input, target);
  const brand = compact(input.serviceName || input.industry || '서비스', 32);
  const industry = compact(input.industry || '서비스', 32);
  const region = compact(input.region || '', 40);
  const benefit = compact(input.benefit || input.keyMessage || '', 140);
  const prompt = compact(input.prompt || '', 180);
  const fields = inquiryFields(input, preset);
  const locationPhrase = region ? `${region}에서 ` : '';
  const benefitText = benefit || `${industry} 이용 전 필요한 조건을 먼저 확인하고, 원하는 상담 또는 예약 내용을 남길 수 있습니다.`;
  const introBody = prompt || `${locationPhrase}${industry} 관련 정보를 확인하고 필요한 다음 행동까지 바로 이어갈 수 있는 페이지입니다.`;
  const formQuestions = [
    { label: '이름', type: 'name', required: true, placeholder: '이름을 입력하세요', options: [] },
    { label: '연락처', type: 'phone', required: true, placeholder: '연락처를 입력하세요', options: [] },
    ...fields.map((label, index) => ({
      label,
      type: index === 0 ? 'long' : 'short',
      required: index === 0,
      placeholder: `${label}을 입력하세요`,
      options: [],
    })),
  ];

  const actionBlock = target === 'reservation'
    ? {
        type: 'reservation',
        title: '방문 예약',
        desc: region ? `${region} 방문 희망 시간을 남겨주세요.` : '방문 희망 시간을 남겨주세요.',
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        start: '10:00',
        end: '18:00',
        interval: 30,
        customFields: fields.map((label, index) => ({
          label,
          type: index === 0 ? 'long' : 'short',
          required: index === 0,
          options: [],
        })),
      }
    : {
        type: 'form',
        title: input.goal === '견적문의' ? '견적 문의' : input.goal === '상품문의' ? '상품 문의' : '상담 신청',
        desc: '필요한 항목을 남기면 확인할 내용을 기준으로 상담을 준비할 수 있습니다.',
        submit: actionLabel,
        style: 'card',
        inputStyle: 'round',
        buttonStyle: 'solid',
        buttonHover: 'fill',
        questions: formQuestions,
      };

  return {
    pageTitle: compact(input.serviceName ? `${input.serviceName} ${input.goal || '상담'}` : `${industry} ${input.goal || '상담'}`, 48),
    brandName: brand,
    templateStyle: input.templateStyle || 'trust',
    qualityNote: warning
      ? 'AI 연결이 완료되지 않아 입력한 brief 기준의 편집 가능한 기본 구조로 시작합니다.'
      : '입력한 brief를 기준으로 첫 화면부터 문의 행동까지 바로 수정할 수 있게 구성했습니다.',
    qualityWarnings: warning ? [compact(warning, 180)] : [],
    primaryAction: { label: actionLabel, target, url: '' },
    theme: fallbackTheme(input.templateStyle || 'trust'),
    blocks: [
      {
        type: 'hero',
        title: compact(input.serviceName ? `${input.serviceName} — ${input.goal || '상담'}` : `${industry} ${input.goal || '상담'}`, 42),
        body: introBody,
        align: 'left',
        height: 'medium',
        titleSize: 'large',
      },
      {
        type: 'text',
        title: '핵심 안내',
        body: benefitText,
        layout: 'card',
        align: 'left',
        size: 'medium',
      },
      {
        type: 'text',
        title: '먼저 확인할 내용',
        body: `${fields.join(', ')} 항목을 기준으로 필요한 내용을 빠르게 확인할 수 있습니다.`,
        layout: 'notice',
        align: 'left',
        size: 'medium',
      },
      actionBlock,
      {
        type: 'links',
        title: '바로 문의',
        layout: 'card',
        items: [{ label: actionLabel, target, url: '', emoji: target === 'reservation' ? '📅' : '💬', iconMode: 'emoji' }],
      },
      {
        type: 'faq',
        title: '자주 묻는 질문',
        layout: 'accordion',
        items: [
          { q: '어떤 내용을 남기면 되나요?', a: `${fields.join(', ')} 등 현재 확인이 필요한 내용을 남겨주세요.` },
          { q: '페이지 내용은 수정할 수 있나요?', a: '생성된 내용은 일반 PageRo 블록으로 만들어져 편집 화면에서 직접 수정할 수 있습니다.' },
        ],
      },
    ],
  };
}

export async function createAiFirstPage({ basePage, input, authUser = null, apiKey = '' } = {}) {
  const brief = aiFirstPageBrief(input);
  let draft;
  let source = 'ai';
  let warning = '';

  try {
    draft = await generateAiDraft({
      apiKey,
      model: basePage?.ai?.model || 'gpt-4.1',
      input: brief,
      page: basePage,
      authUser,
    });
  } catch (error) {
    source = 'brief-fallback';
    warning = String(error?.message || error || 'AI 초안 생성에 실패했습니다.');
    draft = fallbackAiFirstPageDraft(brief, warning);
  }

  let page;
  try {
    page = applyAiDraftToPage(basePage, draft, {
      mode: 'replace',
      updateTheme: true,
      updateFixed: true,
    });
  } catch (error) {
    if (source !== 'ai') throw error;
    source = 'brief-fallback';
    warning = String(error?.message || error || 'AI 초안 적용에 실패했습니다.');
    draft = fallbackAiFirstPageDraft(brief, warning);
    page = applyAiDraftToPage(basePage, draft, {
      mode: 'replace',
      updateTheme: true,
      updateFixed: true,
    });
  }

  return {
    page,
    draft,
    brief,
    source,
    warning,
  };
}
