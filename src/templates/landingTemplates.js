import { clone, defaultPage, newBlock, normalizePageForSave, uid } from '../lib/pageModel.js';

const placeholder = (label, bg = '#f8fafc') =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" rx="44" fill="${bg}"/><rect x="72" y="86" width="756" height="428" rx="36" fill="#fff" opacity=".82"/><text x="450" y="295" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="#111827">${label}</text></svg>`)}`;

const IMG = {
  debtHero: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=86',
  debtOffice: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=86',
  debtSalary: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=84',
  weddingHero: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=86',
  weddingCouple: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=86',
  weddingVenue: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=86',
  estateHero: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=86',
  estateBuilding: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=86',
  estateLounge: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=84',
};

export const LANDING_TEMPLATES = [
  {
    id: 'debt-relief-consult',
    name: '개인회생 빠른 상담형',
    summary: '채무, 압류, 변제금 불안을 비공개 상담으로 빠르게 진단하는 상담형 랜딩페이지입니다.',
    category: '개인회생',
    intent: 'debt',
    cta: '무료 진단 신청',
    chips: ['개인회생', '압류 대응', '비공개 상담'],
    metadata: { conversion: 'form', editableOnly: true, includedBlocks: ['topnav', 'hero', 'links', 'cards', 'text', 'image', 'timer', 'faq', 'form', 'bottombar', 'footer'] },
  },
  {
    id: 'wedding-invitation',
    name: '모바일 청첩장',
    summary: '예식 일정, 갤러리, 오시는 길, 축하 메시지를 한 화면에서 안내하는 모바일 초대장입니다.',
    category: '청첩장',
    intent: 'wedding',
    cta: '축하 메시지 남기기',
    chips: ['예식 안내', '갤러리', '오시는 길'],
    metadata: { conversion: 'form', editableOnly: true, includedBlocks: ['topnav', 'hero', 'timer', 'schedule', 'text', 'image', 'links', 'map', 'faq', 'form', 'bottombar', 'footer'] },
  },
  {
    id: 'quote-request',
    name: '루미에르 리버파크',
    summary: '분양 정보, 방문 예약, 상담 접수를 한 번에 연결하는 부동산 분양 랜딩페이지입니다.',
    category: '분양',
    intent: 'quote',
    cta: '분양 상담 신청',
    chips: ['분양 상담', '방문 예약', '모델하우스'],
    metadata: { conversion: 'form', editableOnly: true, includedBlocks: ['topnav', 'hero', 'timer', 'activity', 'links', 'form', 'reservation', 'text', 'image', 'map', 'faq', 'bottombar', 'footer'] },
  },
];

const COPY = {
  'debt-relief-consult': {
    slug: 'restart-law-care',
    brand: '리:스타트 법률상담센터',
    hero: ['빚과 압류 걱정,\n오늘 비공개로 먼저 진단하세요', '소득, 채무 규모, 부양가족, 재산 상황을 기준으로 개인회생 신청 가능성과 예상 변제 방향을 빠르게 안내합니다. 상담 내용은 비공개로 관리됩니다.'],
    intro: ['지금 필요한 건 막연한 설명이 아니라 현재 상황 기준의 판단입니다.', '개인회생은 누구에게나 같은 답이 나오지 않습니다. 소득, 채무, 재산, 부양가족 조건에 따라 변제금과 진행 가능성이 달라집니다. 먼저 무리한 수임보다 신청 가능성, 예상 부담, 준비 서류를 구분해 안내합니다.'],
    cards: [
      ['압류', '압류 걱정', '급여 또는 통장 압류 진행 단계와 예상 리스크를 먼저 확인합니다.'],
      ['연체', '상환 밀림', '연체 기간과 채권자 수를 기준으로 대응 순서를 정리합니다.'],
      ['소득', '불규칙 소득', '프리랜서, 사업자도 입금 내역과 매출 자료로 검토합니다.'],
      ['서류', '준비 막막', '소득, 채무, 재산 자료를 필요한 순서대로 안내합니다.'],
    ],
    process: [
      ['1단계', '기초 상황 확인', '소득, 채무, 연체 여부를 간단히 확인합니다.'],
      ['2단계', '가능성 검토', '개인회생 신청 가능성과 예상 변제 범위를 안내합니다.'],
      ['3단계', '서류 정리', '필요 자료를 빠짐없이 준비하도록 체크합니다.'],
      ['4단계', '진행 여부 결정', '비용, 기간, 리스크를 설명한 뒤 결정합니다.'],
    ],
    timer: ['오늘 비공개 진단 접수', '현재 상황 기준으로 상담 가능한 시간을 안내합니다.'],
    form: ['개인회생 무료 진단 신청', '채무 상황을 간단히 남겨주시면 가능성, 예상 변제 방향, 준비 서류를 비공개로 안내드립니다.', '무료 진단 받기'],
    questions: [
      ['이름', 'short', true],
      ['연락처', 'phone', true],
      ['직업 형태', 'select', true, ['직장인', '사업자', '프리랜서', '일용직', '무직 또는 휴직']],
      ['월 평균 소득', 'short', false],
      ['총 채무액', 'select', true, ['3천만 원 미만', '3천만~7천만 원', '7천만~1억 원', '1억 원 이상', '상담 후 확인']],
      ['압류 또는 독촉 상황', 'select', false, ['아직 없음', '독촉 연락 있음', '지급명령 수신', '급여압류 우려', '통장압류 우려']],
      ['상담 내용', 'long', false],
    ],
    faq: [
      ['연체 전에도 상담을 받을 수 있나요?', '가능합니다. 연체가 시작되기 전에도 채무 구조와 소득 자료를 기준으로 신청 가능성과 대응 순서를 검토할 수 있습니다.'],
      ['가족이나 회사에 바로 알려지나요?', '상담 내용은 비공개로 관리됩니다. 진행 과정에서 확인이 필요한 경우에도 먼저 안내한 뒤 필요한 범위를 설명합니다.'],
      ['직장인이 아니어도 가능한가요?', '반복적인 소득을 설명할 수 있다면 사업자, 프리랜서, 일용직도 검토할 수 있습니다. 자료 형태가 중요합니다.'],
      ['상담만 받아도 비용이 생기나요?', '기초 진단 상담은 무료입니다. 정식 사건 진행이 필요한 경우 비용 구조를 먼저 안내합니다.'],
    ],
  },
  'wedding-invitation': {
    slug: 'our-wedding-day',
    brand: '서하 그리고 지우',
    hero: ['서하 그리고 지우,\n저희 결혼합니다', '오랜 시간 서로의 계절이 되어준 두 사람이 이제 한 집의 이름으로 걸어가려 합니다. 소중한 날에 함께해 주세요.'],
    intro: ['INVITATION', '서로 다른 길을 걷던 두 사람이 같은 방향을 바라보게 되었습니다. 바쁘시더라도 귀한 걸음으로 축복해 주시면 큰 기쁨으로 간직하겠습니다.'],
    date: ['2026.10.24 SAT 12:30 PM', '라움 아트센터 2층 마제스틱홀'],
    timer: ['예식까지 남은 시간', '소중한 날까지 함께 기다려 주세요.'],
    story: ['우리의 이야기', '신랑 김지우\n따뜻한 마음과 성실함을 가진 사람\n\n신부 이서하\n밝은 웃음과 단단한 마음을 가진 사람'],
    links: ['연락 및 안내', '신랑에게 연락', '신부에게 연락', '오시는 길 보기'],
    form: ['축하 메시지 남기기', '두 사람에게 전하고 싶은 따뜻한 말을 남겨주세요.', '축하 메시지 보내기'],
    questions: [['성함', 'short', true], ['축하 메시지', 'long', true]],
    faq: [
      ['주차가 가능한가요?', '예식장 지하 주차장을 이용하실 수 있습니다. 주말 혼잡이 예상되어 대중교통 이용도 권장드립니다.'],
      ['화환을 보내도 되나요?', '축하의 마음만으로도 충분히 감사드립니다. 화환은 정중히 사양합니다.'],
      ['식사는 준비되어 있나요?', '예식 후 같은 층 연회장에서 식사가 준비되어 있습니다.'],
    ],
  },
  'quote-request': {
    slug: 'lumiere-riverpark',
    brand: '루미에르 리버파크',
    hero: ['루미에르 리버파크\n한강 생활권 프리미엄 주거', 'GRAND OPEN. 관심 타입과 예산대를 남기면 잔여 호실, 분양가 범위, 모델하우스 방문 가능 시간을 순서대로 안내합니다.'],
    overview: ['PROJECT OVERVIEW', '총 1,248세대 대단지\n지하 5층부터 지상 49층까지의 랜드마크 설계\n59A, 74A, 84A, 84B 등 실수요 선호 타입 구성'],
    lifestyle: ['LIFESTYLE', '스카이라운지, 입주민 전용 피트니스, 게스트하우스, 키즈 커뮤니티까지 일상 안에서 휴식과 이동, 교류가 완성되는 라이프스타일을 제안합니다.'],
    visit: ['LOCATION & VISIT', '모델하우스는 사전 예약제로 운영됩니다. 신청 후 분양 담당자가 관심 타입, 예산대, 방문 가능 시간을 확인해 예약을 확정합니다.'],
    form: ['관심고객 등록', '관심 타입만 남겨주세요. 분양가 범위와 상담 가능 시간 확인 후 연락드립니다.', '관심고객 등록하기'],
    reservation: ['모델하우스 방문 예약', '원하는 방문 날짜와 시간을 선택해 주세요.', '방문 예약 신청하기'],
    reservationFields: [['관심 타입', 'select', false, ['59A', '74A', '84A', '84B', '상담 후 결정']], ['방문 목적', 'select', false, ['분양가 상담', '잔여 호실 확인', '대출 조건 상담', '계약 조건 상담']]],
    questions: [['이름', 'short', true], ['연락처', 'phone', true], ['관심 타입', 'select', true, ['59A', '74A', '84A', '84B', '상담 후 결정']], ['예산대', 'select', false, ['5억 미만', '5억~7억', '7억~10억', '10억 이상', '상담 후 결정']]],
    faq: [
      ['잔여 호실과 타입을 바로 확인할 수 있나요?', '상담 신청 시점 기준으로 가능한 타입과 잔여 호실 범위를 확인해 안내합니다.'],
      ['모델하우스 방문 전 분양가를 알 수 있나요?', '전화 상담으로 관심 타입의 분양가 범위와 계약 조건을 먼저 안내받은 뒤 방문 여부를 결정할 수 있습니다.'],
      ['방문 예약은 어떻게 확정되나요?', '신청 정보를 확인한 뒤 분양 담당자가 연락드립니다. 원하는 시간과 현장 예약 상황을 맞춰 확정합니다.'],
    ],
  },
};

function makeBlock(type, settings = {}) {
  const base = clone(defaultPage.blocks.find((item) => item.type === type) || newBlock(type));
  return { ...base, id: uid(), visible: true, s: { ...(base.s || {}), ...settings, anchorId: settings.anchorId || type } };
}

function q([label, type, required, options = []]) {
  return { id: uid(), label, type, required, options };
}

function reservationField([label, type, required, options = []]) {
  return { id: uid(), label, type, required, options };
}

function cardItem([eyebrow, title, body]) {
  return { id: uid(), eyebrow, title, body };
}

function hero(template, copy) {
  const image = template.intent === 'quote' ? IMG.estateHero : template.intent === 'wedding' ? IMG.weddingHero : IMG.debtHero;
  return makeBlock('hero', {
    title: copy.hero[0],
    body: copy.hero[1],
    image,
    imageFallback: placeholder(copy.brand, template.intent === 'wedding' ? '#f7e7df' : template.intent === 'debt' ? '#eef4ff' : '#f8fafc'),
    imageMode: 'full',
    imageFit: 'cover',
    heroBleed: 'page',
    overlay: true,
    overlayColor: template.intent === 'wedding' ? '#231916' : template.intent === 'quote' ? '#120d0b' : '#0f172a',
    overlayOpacity: template.intent === 'wedding' ? 36 : template.intent === 'quote' ? 56 : 46,
    height: 'large',
    titleSize: 'large',
    bodySize: 'medium',
    align: 'center',
  });
}

function faq(copy, title = '자주 묻는 질문') {
  return makeBlock('faq', { title, items: copy.faq.map(([question, answer]) => ({ id: uid(), q: question, a: answer })) });
}

function bottom(template) {
  const quote = template.intent === 'quote';
  const wedding = template.intent === 'wedding';
  return makeBlock('bottombar', {
    count: 2,
    buttons: [
      { id: uid(), enabled: true, icon: wedding ? '축하' : quote ? '상담' : '진단', label: wedding ? '축하 메시지' : quote ? '분양 상담' : template.cta, target: 'form', url: '' },
      { id: uid(), enabled: true, icon: wedding ? '지도' : quote ? '예약' : '전화', label: wedding ? '오시는 길' : quote ? '방문 예약' : '전화 문의', target: wedding ? 'map' : quote ? 'reservation' : 'phone', url: quote || wedding ? '' : 'tel:0200000000' },
    ],
  });
}

function footer(copy, options = {}) {
  return makeBlock('footer', {
    company: copy.brand,
    owner: options.owner || '관리자',
    phone: options.phone || '',
    address: options.address || '',
    biz: options.biz || '000-00-00000',
    privacyUrl: options.privacyUrl ?? '/privacy',
    termsUrl: options.termsUrl ?? '/terms',
  });
}

function buildDebt(template, copy) {
  return [
    makeBlock('topnav', { logoText: copy.brand, logoStyle: 'badge', logoColor: '#1D4ED8', bg: 'white', sticky: true, menus: [
      { id: uid(), label: '무료 진단', target: 'form', url: '' },
      { id: uid(), label: '상담 절차', target: 'process', url: '' },
      { id: uid(), label: '문의 FAQ', target: 'faq', url: '' },
    ] }),
    hero(template, copy),
    makeBlock('links', { title: '먼저 현재 상황을 골라보세요', layout: 'card', items: [
      { id: uid(), emoji: '급여', iconMode: 'thumb', thumb: IMG.debtSalary, label: '급여 소득자 변제금 진단', target: 'form', url: '' },
      { id: uid(), emoji: '압류', iconMode: 'thumb', thumb: IMG.debtOffice, label: '압류와 독촉 상담', target: 'form', url: '' },
    ] }),
    makeBlock('text', { title: copy.intro[0], body: copy.intro[1], layout: 'card', align: 'left', size: 'large', anchorId: 'intro' }),
    makeBlock('cards', { title: '상담 전 많이 묻는 상황', desc: '아래 중 하나라도 해당되면 먼저 가능성을 확인하는 편이 안전합니다.', items: copy.cards.map(cardItem), layout: 'grid', tone: 'soft', columns: 2, anchorId: 'cases' }),
    makeBlock('timer', { title: copy.timer[0], label: 'TODAY CONSULT', desc: copy.timer[1], repeatMode: 'daily24', timerTheme: 'minimal', urgentStyle: 'line', style: 'card', align: 'center', cta: true, ctaTarget: 'form', ctaLabel: '무료 진단 신청' }),
    makeBlock('image', { image: IMG.debtOffice, imageFallback: placeholder('Private Consult', '#eef4ff'), imageDisplay: 'fill', imageHeightPx: 340, rounded: true, caption: '상담 내용은 비공개로 관리되며 진행 가능성은 개인 상황에 따라 달라질 수 있습니다.' }),
    makeBlock('cards', { title: '진행 흐름', desc: '상담부터 진행 여부 결정까지 단계별로 안내합니다.', items: copy.process.map(cardItem), layout: 'steps', tone: 'outline', columns: 1, anchorId: 'process' }),
    faq(copy, '개인회생 상담 전 확인 사항'),
    makeBlock('form', { title: copy.form[0], desc: copy.form[1], submit: copy.form[2], style: 'card', textAlign: 'left', buttonColorMode: 'theme', privacy: '개인정보 수집 및 이용에 동의합니다.', privacyRequired: true, privacyDetail: '수집 항목: 이름, 연락처, 직업 형태, 소득, 채무, 상담 내용\n이용 목적: 상담 안내 및 문의 응대\n보관 기간: 상담 종료 후 내부 기준에 따라 보관', questions: copy.questions.map(q) }),
    bottom(template),
    footer(copy, { owner: '상담책임자', phone: '02-0000-0000' }),
  ];
}

function buildWedding(template, copy) {
  return [
    makeBlock('topnav', { logoText: copy.brand, logoStyle: 'plain', bg: 'transparent', sticky: true, menus: [
      { id: uid(), label: '예식 안내', target: 'schedule', url: '' },
      { id: uid(), label: '오시는 길', target: 'map', url: '' },
      { id: uid(), label: '축하 메시지', target: 'form', url: '' },
    ] }),
    hero(template, copy),
    makeBlock('text', { title: copy.intro[0], body: copy.intro[1], layout: 'plain', align: 'center', size: 'large' }),
    makeBlock('image', { image: IMG.weddingCouple, imageFallback: placeholder('Wedding Photo', '#f7e7df'), imageDisplay: 'fill', imageHeightPx: 420, rounded: true, caption: '사진은 편집기에서 바로 교체할 수 있습니다.' }),
    makeBlock('timer', { title: copy.timer[0], label: 'WEDDING DAY', desc: copy.timer[1], endAt: '2026-10-24T12:30:00+09:00', repeatMode: 'fixed', timerTheme: 'minimal', urgentStyle: 'flip', style: 'soft', align: 'center', cta: false }),
    makeBlock('schedule', { title: '예식 안내', date: '2026-10-24', body: `오후 12시 30분\n${copy.date[1]}`, highlightColor: '#8AA2C8', cardBgColor: '#FFFFFF', textColor: '#3F3F46', align: 'center' }),
    makeBlock('text', { title: copy.date[0], body: copy.date[1], layout: 'card', align: 'center', size: 'large' }),
    makeBlock('text', { title: copy.story[0], body: copy.story[1], layout: 'plain', align: 'center' }),
    makeBlock('links', { title: copy.links[0], layout: 'card', items: [
      { id: uid(), emoji: '신랑', iconMode: 'thumb', thumb: IMG.weddingHero, label: copy.links[1], target: '', url: 'tel:010-0000-0000' },
      { id: uid(), emoji: '신부', iconMode: 'thumb', thumb: IMG.weddingCouple, label: copy.links[2], target: '', url: 'tel:010-0000-0000' },
      { id: uid(), emoji: '지도', iconMode: 'thumb', thumb: IMG.weddingVenue, label: copy.links[3], target: 'map', url: '' },
    ] }),
    makeBlock('map', { title: '오시는 길', placeName: copy.date[1], address: '서울 강남구 언주로 564', parkingText: '예식장 지하 주차장을 이용하실 수 있습니다. 대중교통 이용 시 선정릉역에서 도보 이동이 가능합니다.' }),
    faq(copy, '예식 안내'),
    makeBlock('form', { title: copy.form[0], desc: copy.form[1], submit: copy.form[2], style: 'card', textAlign: 'left', buttonColorMode: 'theme', successTitle: '축하 메시지가 전달되었습니다.', success: '소중한 마음을 남겨주셔서 감사합니다.', privacy: '', privacyRequired: false, privacyDetail: '', questions: copy.questions.map(q) }),
    bottom(template),
    footer(copy, { privacyUrl: '', termsUrl: '' }),
  ];
}

function buildQuote(template, copy) {
  return [
    makeBlock('topnav', { logoText: copy.brand, logoStyle: 'badge', logoColor: '#111827', bg: 'transparent', sticky: true, menus: [
      { id: uid(), label: '분양 상담', target: 'form', url: '' },
      { id: uid(), label: '방문 예약', target: 'reservation', url: '' },
      { id: uid(), label: '문의 안내', target: 'faq', url: '' },
    ] }),
    hero(template, copy),
    makeBlock('timer', { title: '그랜드 오픈 사전 상담', label: '상담 마감까지', desc: '관심고객 등록 순서에 따라 타입별 상담 가능 시간을 안내합니다.', repeatMode: 'daily24', timerTheme: 'accent', urgentStyle: 'flip', style: 'accent', align: 'center', cta: true, ctaTarget: 'form', ctaLabel: '분양 상담 신청' }),
    makeBlock('activity', { title: '실시간 접수 현황', mode: 'feed', dataSource: 'sample', sampleKind: 'both', style: 'glass', animation: 'stack', align: 'left', baseCount: 18 }),
    makeBlock('links', { title: '지금 확인할 수 있는 분양 정보', layout: 'card', items: [
      { id: uid(), emoji: '방문', iconMode: 'thumb', thumb: IMG.estateBuilding, label: '모델하우스 방문 예약', target: 'reservation', url: '' },
      { id: uid(), emoji: '상담', iconMode: 'thumb', thumb: IMG.estateLounge, label: '관심고객 등록', target: 'form', url: '' },
    ] }),
    makeBlock('text', { title: copy.overview[0], body: copy.overview[1], layout: 'card', align: 'center', size: 'large' }),
    makeBlock('image', { image: IMG.estateBuilding, imageFallback: placeholder('Lumiere Riverpark', '#2b211a'), imageDisplay: 'fill', imageHeightPx: 420, rounded: true, caption: '' }),
    makeBlock('text', { title: copy.lifestyle[0], body: copy.lifestyle[1], layout: 'notice', align: 'center', size: 'large' }),
    makeBlock('map', { title: '루미에르 리버파크 모델하우스', placeName: '루미에르 리버파크 모델하우스', address: '서울 송파구 올림픽로 300', parkingText: '사전 예약 고객은 현장 주차 등록을 지원합니다.' }),
    faq(copy, '분양 상담 전 확인 사항'),
    makeBlock('text', { title: copy.visit[0], body: copy.visit[1], layout: 'plain', align: 'center' }),
    makeBlock('form', { title: copy.form[0], desc: copy.form[1], submit: copy.form[2], style: 'card', textAlign: 'left', buttonColorMode: 'theme', questions: copy.questions.map(q) }),
    makeBlock('reservation', { title: copy.reservation[0], desc: copy.reservation[1], submit: copy.reservation[2], style: 'card', textAlign: 'left', buttonColorMode: 'theme', weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], weekdayMode: 'everyday', start: '10:00', end: '18:00', interval: 30, fields: { name: true, phone: true }, required: { name: true, phone: true }, customFields: copy.reservationFields.map(reservationField) }),
    bottom(template),
    footer(copy),
  ];
}

export function getLandingTemplate(templateId) {
  return LANDING_TEMPLATES.find((template) => template.id === templateId) || LANDING_TEMPLATES[0];
}

export function createTemplatePage(templateId, basePage = defaultPage) {
  const template = getLandingTemplate(templateId);
  const copy = COPY[template.id];
  const blocks = template.id === 'quote-request'
    ? buildQuote(template, copy)
    : template.id === 'wedding-invitation'
      ? buildWedding(template, copy)
      : buildDebt(template, copy);
  const theme = template.id === 'quote-request'
    ? { ...(basePage?.theme || defaultPage.theme), accent: '#F97316', buttonEffect: 'fill' }
    : template.id === 'wedding-invitation'
      ? { ...(basePage?.theme || defaultPage.theme), accent: '#B97A63', buttonEffect: 'fill' }
      : { ...(basePage?.theme || defaultPage.theme), accent: '#1D4ED8', bg: '#F5F7FB', bgSolid: '#F5F7FB', card: '#FFFFFF', text: '#172033', buttonEffect: 'fill' };
  return normalizePageForSave({ ...clone(basePage || defaultPage), title: template.name, slug: copy.slug, theme, blocks });
}

export function templateInputPatch(template) {
  const selected = typeof template === 'string' ? getLandingTemplate(template) : getLandingTemplate(template?.id);
  const isQuote = selected.id === 'quote-request';
  const isWedding = selected.id === 'wedding-invitation';
  const isDebt = selected.id === 'debt-relief-consult';
  return {
    goal: isQuote ? '분양 상담' : isWedding ? '모바일 청첩장' : isDebt ? '개인회생 무료 진단' : '상담 신청',
    contactMethod: isQuote ? '분양 상담 신청 폼' : isWedding ? '연락, 계좌, 오시는 길 안내' : isDebt ? '비공개 상담 신청 폼' : `${selected.cta} 폼`,
    industry: selected.category,
    serviceName: COPY[selected.id]?.brand || selected.name,
  };
}
