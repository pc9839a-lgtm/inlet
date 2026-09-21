import { newBlock, sanitizeBlock, uid } from '../../lib/pageModel.js';

function block(type, settings = {}) {
  const base = newBlock(type);
  return sanitizeBlock({
    ...base,
    id: uid(),
    s: { ...(base.s || {}), ...settings },
  });
}

function cards(items, settings = {}) {
  return block('cards', {
    title: settings.title || '핵심 포인트',
    desc: settings.desc || '',
    layout: 'grid',
    tone: 'soft',
    align: 'left',
    columns: settings.columns || 3,
    items: items.map(([eyebrow, title, body]) => ({ id: uid(), eyebrow, title, body })),
    ...settings,
  });
}

function faq(items, title = '자주 묻는 질문') {
  return block('faq', {
    title,
    layout: 'accordion',
    firstOpen: true,
    items: items.map(([q, a]) => ({ id: uid(), q, a })),
  });
}

function form(settings = {}) {
  const base = newBlock('form');
  return sanitizeBlock({
    ...base,
    id: uid(),
    s: {
      ...(base.s || {}),
      title: settings.title || '상담 신청',
      desc: settings.desc || '연락처를 남겨주시면 확인 후 안내드립니다.',
      submit: settings.submit || '상담 신청하기',
      questions: settings.questions || base.s?.questions || [],
      ...settings,
    },
  });
}

export const SECTION_PATTERNS = [
  {
    id: 'lead-hero-form',
    group: 'recommended',
    label: '상담 히어로 + 문의',
    description: '첫 화면에서 핵심 제안과 상담 신청까지 바로 이어집니다.',
    tags: ['광고', '상담', '전환'],
    create: () => [
      block('hero', {
        title: '고객이 바로 이해하는\n핵심 제안을 적어주세요',
        body: '누구에게 어떤 도움을 주는지 한 문장으로 설명하고 바로 상담으로 연결하세요.',
        align: 'left',
        titleSize: 'large',
        bodySize: 'medium',
        height: 'large',
        overlay: true,
      }),
      form({
        title: '빠른 상담 신청',
        desc: '필요한 정보만 남기면 담당자가 확인 후 연락드립니다.',
        submit: '상담 신청하기',
      }),
    ],
  },
  {
    id: 'benefit-trust',
    group: 'recommended',
    label: '핵심 장점 + FAQ',
    description: '장점 3개와 고객이 망설이는 질문을 한 번에 정리합니다.',
    tags: ['장점', '신뢰', 'FAQ'],
    create: () => [
      cards([
        ['01', '첫 번째 강점', '경쟁사와 다른 핵심 장점을 짧게 설명하세요.'],
        ['02', '두 번째 강점', '고객이 실제로 체감하는 이점을 적어주세요.'],
        ['03', '세 번째 강점', '문의 전에 꼭 알아야 할 신뢰 요소를 보여주세요.'],
      ], { title: '왜 이 서비스를 선택해야 하나요?', columns: 3 }),
      faq([
        ['상담은 어떻게 진행되나요?', '신청 정보를 확인한 뒤 담당자가 순서대로 안내합니다.'],
        ['비용은 언제 알 수 있나요?', '조건을 확인한 뒤 필요한 범위와 비용을 먼저 안내합니다.'],
        ['바로 결정해야 하나요?', '아닙니다. 안내를 확인한 뒤 진행 여부를 결정할 수 있습니다.'],
      ]),
    ],
  },
  {
    id: 'visit-conversion',
    group: 'recommended',
    label: '오시는 길 + 방문 예약',
    description: '오프라인 상담·매장·모델하우스 방문 전환에 맞춘 구성입니다.',
    tags: ['지도', '예약', '방문'],
    create: () => [
      block('map', {
        eyebrow: 'LOCATION',
        sectionTitle: '오시는 길',
        placeName: '방문 장소',
        title: '방문 장소',
        address: '주소를 입력하세요',
        showMapLinks: true,
        showEmbedMap: true,
      }),
      block('reservation', {
        title: '방문 예약',
        desc: '희망 날짜와 시간을 선택해 주세요.',
        success: '방문 예약 신청이 접수되었습니다.',
      }),
    ],
  },
  {
    id: 'debt-consult',
    group: 'industry',
    industry: '개인회생',
    label: '개인회생 진단 섹션',
    description: '채무 상황 → 신뢰 FAQ → 비공개 상담으로 이어지는 구성입니다.',
    tags: ['개인회생', '법률상담'],
    create: () => [
      cards([
        ['채무', '채무 규모 확인', '총 채무액과 채권자 수를 기준으로 현재 상황을 정리합니다.'],
        ['소득', '소득 구조 확인', '직장인·사업자·프리랜서 등 소득 형태를 확인합니다.'],
        ['압류', '압류·독촉 확인', '현재 진행 중인 독촉이나 압류 위험을 함께 검토합니다.'],
      ], { title: '현재 상황부터 빠르게 확인하세요', columns: 3 }),
      faq([
        ['연체 전에도 상담할 수 있나요?', '연체 전에도 채무와 소득 구조를 기준으로 검토할 수 있습니다.'],
        ['직장인이 아니어도 가능한가요?', '사업자·프리랜서도 반복적인 소득을 설명할 자료가 있다면 검토할 수 있습니다.'],
        ['상담 내용은 공개되나요?', '상담 내용은 문의 응대를 위한 범위에서 관리됩니다.'],
      ], '개인회생 상담 전 자주 묻는 질문'),
      form({
        title: '비공개 가능성 진단',
        desc: '현재 채무와 소득 상황을 남겨주시면 확인 후 안내드립니다.',
        submit: '무료 진단 신청',
        questions: [
          { id: uid(), label: '이름', type: 'short', required: true, options: [] },
          { id: uid(), label: '연락처', type: 'phone', required: true, options: [] },
          { id: uid(), label: '총 채무액', type: 'select', required: true, options: ['3천만 원 미만', '3천만~7천만 원', '7천만~1억 원', '1억 원 이상'] },
          { id: uid(), label: '직업 형태', type: 'select', required: false, options: ['직장인', '사업자', '프리랜서', '기타'] },
        ],
      }),
    ],
  },
  {
    id: 'realestate-visit',
    group: 'industry',
    industry: '분양',
    label: '분양 상담 + 방문 예약',
    description: '핵심 분양 포인트와 모델하우스 방문 예약을 연결합니다.',
    tags: ['분양', '모델하우스'],
    create: () => [
      cards([
        ['TYPE', '선호 타입', '관심 평형과 타입을 한눈에 보여주세요.'],
        ['PRICE', '분양가 안내', '상담 가능한 분양가 범위와 조건을 안내하세요.'],
        ['VISIT', '방문 상담', '모델하우스 방문 일정을 빠르게 예약할 수 있습니다.'],
      ], { title: '관심 고객이 먼저 확인하는 정보', columns: 3 }),
      block('map', {
        eyebrow: 'LOCATION',
        sectionTitle: '모델하우스 위치',
        placeName: '모델하우스',
        title: '모델하우스',
        address: '모델하우스 주소를 입력하세요',
        showMapLinks: true,
        showEmbedMap: true,
      }),
      block('reservation', {
        title: '모델하우스 방문 예약',
        desc: '희망 방문 일정을 선택해 주세요.',
        success: '방문 예약 신청이 접수되었습니다.',
      }),
    ],
  },
  {
    id: 'wedding-info',
    group: 'industry',
    industry: '청첩장',
    label: '예식 안내 + 오시는 길',
    description: '예식 일정, 위치, 참석 여부를 한 흐름으로 구성합니다.',
    tags: ['청첩장', '예식'],
    create: () => [
      block('schedule', {
        title: '예식 안내',
        body: '예식 시간과 장소를 입력하세요.',
        align: 'center',
      }),
      block('map', {
        eyebrow: 'LOCATION',
        sectionTitle: '오시는 길',
        placeName: '예식장',
        title: '예식장',
        address: '예식장 주소를 입력하세요',
        showMapLinks: true,
        showEmbedMap: true,
      }),
      form({
        title: '참석 여부와 축하 메시지',
        desc: '참석 여부와 두 사람에게 전할 메시지를 남겨주세요.',
        submit: '마음 전하기',
        questions: [
          { id: uid(), label: '성함', type: 'short', required: true, options: [] },
          { id: uid(), label: '참석 여부', type: 'select', required: true, options: ['참석합니다', '마음으로 축하합니다', '아직 미정입니다'] },
          { id: uid(), label: '축하 메시지', type: 'long', required: false, options: [] },
        ],
      }),
    ],
  },
];

export function getSectionPattern(patternId) {
  return SECTION_PATTERNS.find((pattern) => pattern.id === patternId) || null;
}

export function createSectionPatternBlocks(patternId) {
  const pattern = getSectionPattern(patternId);
  if (!pattern) return [];
  return pattern.create().map((item) => sanitizeBlock(item));
}

export function getSectionPatterns(group) {
  return SECTION_PATTERNS.filter((pattern) => !group || pattern.group === group);
}
