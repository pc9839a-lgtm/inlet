import { validateAiDraftJson } from './aiDraftSchema.js';

export const AI_BLOCK_LABELS = {
  hero: '히어로',
  text: '텍스트',
  benefit: '혜택',
  faq: 'FAQ',
  image: '이미지',
  map: '지도',
  links: '링크',
  timer: '타이머',
  activity: '실시간 접수',
  spacer: '여백',
  divider: '구분선',
  form: '상담 폼',
  reservation: '방문 예약',
};

const uid = () => Math.random().toString(36).slice(2, 10);

function block(type, s = {}) {
  return { id: uid(), type, visible: true, s };
}

function pickSafe(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function safeColor(value, fallback) {
  const raw = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function shortText(value, fallback, max = 18) {
  const text = String(value || fallback || '').trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

function normalizeOptionList(options = [], limit = 6) {
  return (Array.isArray(options) ? options : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function cleanUrl(value = '') {
  const raw = String(value || '').trim();
  if (/^tel:\d[\d-]+$/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^https?:/i.test(raw)) return raw;
  return '';
}

function templateDefaults(templateStyle = 'trust') {
  const map = {
    trust: {
      heroAlign: 'left',
      heroHeight: 'medium',
      textLayout: 'card',
      linksLayout: 'list',
      timerStyle: 'card',
      timerTheme: 'modern',
      timerEffect: 'line',
      activityStyle: 'glass',
      formStyle: 'card',
      inputStyle: 'round',
      buttonStyle: 'solid',
      buttonHover: 'fill',
      accent: '#1f2937',
      bgMode: 'gradient',
      bgSolid: '#F5F7FA',
      gradientFrom: '#F8FAFC',
      gradientTo: '#EAF2FF',
      card: '#FFFFFF',
      text: '#111827',
      radius: 24,
      buttonEffect: 'fill',
      animType: 'up',
    },
    promo: {
      heroAlign: 'center',
      heroHeight: 'large',
      textLayout: 'notice',
      linksLayout: 'card',
      timerStyle: 'accent',
      timerTheme: 'accent',
      timerEffect: 'flip',
      activityStyle: 'dark',
      formStyle: 'soft',
      inputStyle: 'round',
      buttonStyle: 'round',
      buttonHover: 'slide',
      accent: '#ef4444',
      bgMode: 'gradient',
      bgSolid: '#FFF7ED',
      gradientFrom: '#FFF7ED',
      gradientTo: '#FFE4E6',
      card: '#FFFFFF',
      text: '#111827',
      radius: 28,
      buttonEffect: 'burst',
      animType: 'scale',
    },
    booking: {
      heroAlign: 'left',
      heroHeight: 'medium',
      textLayout: 'card',
      linksLayout: 'card',
      timerStyle: 'plain',
      timerTheme: 'minimal',
      timerEffect: 'line',
      activityStyle: 'minimal',
      formStyle: 'card',
      inputStyle: 'box',
      buttonStyle: 'solid',
      buttonHover: 'fill',
      accent: '#2563eb',
      bgMode: 'gradient',
      bgSolid: '#F5F7FA',
      gradientFrom: '#F8FAFC',
      gradientTo: '#DBEAFE',
      card: '#FFFFFF',
      text: '#0f172a',
      radius: 24,
      buttonEffect: 'shine',
      animType: 'up',
    },
    story: {
      heroAlign: 'left',
      heroHeight: 'large',
      textLayout: 'plain',
      linksLayout: 'list',
      timerStyle: 'card',
      timerTheme: 'glass',
      timerEffect: 'flow',
      activityStyle: 'glass',
      formStyle: 'minimal',
      inputStyle: 'underline',
      buttonStyle: 'solid',
      buttonHover: 'zoom',
      accent: '#0f766e',
      bgMode: 'solid',
      bgSolid: '#F3FAF8',
      gradientFrom: '#F3FAF8',
      gradientTo: '#E0F2FE',
      card: '#FFFFFF',
      text: '#111827',
      radius: 32,
      buttonEffect: 'fill',
      animType: 'fade',
    },
    compare: {
      heroAlign: 'left',
      heroHeight: 'medium',
      textLayout: 'notice',
      linksLayout: 'carousel',
      timerStyle: 'accent',
      timerTheme: 'modern',
      timerEffect: 'line',
      activityStyle: 'minimal',
      formStyle: 'line',
      inputStyle: 'box',
      buttonStyle: 'solid',
      buttonHover: 'slide',
      accent: '#7c3aed',
      bgMode: 'gradient',
      bgSolid: '#F8FAFC',
      gradientFrom: '#F8FAFC',
      gradientTo: '#EDE9FE',
      card: '#FFFFFF',
      text: '#111827',
      radius: 20,
      buttonEffect: 'shine',
      animType: 'up',
    },
  };
  return map[templateStyle] || map.trust;
}

function normalizeAiBlockItem(item = {}) {
  if (item.type === 'benefit') {
    return {
      ...item,
      type: 'text',
      title: item.title || '혜택',
      body: item.body || item.desc || '',
      layout: item.layout || 'card',
    };
  }

  if (item.type === 'image') {
    const image = item.image || item.url || item.src || '';
    const gallery = Array.isArray(item.gallery) ? item.gallery.filter(Boolean) : [];
    if (!image && !gallery.length) return null;
    return { ...item, image, gallery };
  }

  return item;
}

function normalizeQuestion(question = {}) {
  const allowed = ['name','short','phone','email','long','select','multi','address'];
  const label = String(question.label || '질문').trim();
  const inferredType = /이름|성함|name/i.test(label)
    ? 'name'
    : /연락처|전화|휴대폰|phone/i.test(label)
      ? 'phone'
      : /이메일|메일|email/i.test(label)
        ? 'email'
        : /주소|지역|address/i.test(label)
          ? 'address'
          : question.type;
  return {
    id: uid(),
    label: label || '질문',
    type: allowed.includes(inferredType) ? inferredType : 'short',
    required: question.required !== false,
    placeholder: question.placeholder || '',
    options: normalizeOptionList(question.options),
  };
}

function ensureLeadQuestions(questions = []) {
  const normalized = questions.map(normalizeQuestion);
  const hasName = normalized.some((q) => q.type === 'name' || /이름|성함/i.test(q.label));
  const hasPhone = normalized.some((q) => q.type === 'phone' || /연락처|전화|휴대폰/i.test(q.label));
  const hasNeed = normalized.some((q) => !['name', 'phone', 'email'].includes(q.type));
  const base = [
    ...(hasName ? [] : [normalizeQuestion({ label: '이름', type: 'name', required: true, placeholder: '성함을 입력해주세요' })]),
    ...(hasPhone ? [] : [normalizeQuestion({ label: '연락처', type: 'phone', required: true, placeholder: '010-0000-0000' })]),
    ...normalized,
    ...(hasNeed ? [] : [normalizeQuestion({ label: '상담이 필요한 내용', type: 'long', required: false, placeholder: '현재 상황이나 원하는 내용을 적어주세요' })]),
  ];
  return base.slice(0, 6);
}

function normalizeTargetForDraft(target, generatedBlocks = []) {
  const raw = String(target || '').trim();
  if (['url','phone'].includes(raw)) return raw;
  const matched = generatedBlocks.find((blockItem) => blockItem.type === raw);
  return matched?.id ? `block:${matched.id}` : raw || 'form';
}

function targetEmoji(target) {
  if (target === 'reservation') return '📅';
  if (target === 'phone') return '📞';
  if (target === 'url') return '↗';
  return '💬';
}

function safeLinkItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((link) => {
      const target = pickSafe(link.target, ['form','reservation','phone','url'], 'form');
      const url = cleanUrl(link.url);
      if (target === 'phone' && !/^tel:/i.test(url)) return null;
      if (target === 'url' && !/^https?:\/\//i.test(url)) return null;
      return {
        id: uid(),
        emoji: Object.prototype.hasOwnProperty.call(link, 'emoji') ? link.emoji : targetEmoji(target),
        iconMode: pickSafe(link.iconMode, ['none','emoji','thumb'], 'emoji'),
        thumb: '',
        label: shortText(link.label, target === 'reservation' ? '예약하기' : target === 'phone' ? '전화하기' : '상담하기', 18),
        target,
        url,
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeWeekdays(days = []) {
  const safe = ['mon','tue','wed','thu','fri','sat','sun'];
  const picked = (Array.isArray(days) ? days : []).filter((day) => safe.includes(day));
  return picked.length ? picked.slice(0, 7) : ['mon','tue','wed','thu','fri'];
}

function normalizeTime(value, fallback) {
  const raw = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

function normalizeReservationFields(fields = []) {
  const allowed = ['short','long','select'];
  return (Array.isArray(fields) ? fields : [])
    .map((field) => ({
      id: uid(),
      label: shortText(field.label, '추가 확인 항목', 18),
      type: pickSafe(field.type, allowed, 'short'),
      required: !!field.required,
      options: normalizeOptionList(field.options, 5),
    }))
    .filter((field) => field.label)
    .slice(0, 4);
}

function normalizeFaqItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: uid(),
      q: shortText(item.q || item.question, '질문', 48),
      a: String(item.a || item.answer || '').trim() || '상담 시 자세히 안내드립니다.',
    }))
    .filter((item) => item.q || item.a)
    .slice(0, 8);
}

export function aiDraftToBlocks(draft) {
  const template = draft.templateStyle || 'trust';
  const defaults = templateDefaults(template);
  const normalizedDraft = {
    ...draft,
    blocks: Array.isArray(draft.blocks) ? draft.blocks.map(normalizeAiBlockItem).filter(Boolean) : [],
  };

  const check = validateAiDraftJson(normalizedDraft);
  if (!check.ok) throw new Error(check.message);

  return normalizedDraft.blocks.map((item) => {
    if (item.type === 'hero') {
      return block('hero', {
        title: item.title || draft.pageTitle || '랜딩페이지 초안',
        body: item.body || '',
        image: '',
        imageMode: 'top',
        imageFit: 'cover',
        fullText: true,
        align: pickSafe(item.align, ['left','center','right'], defaults.heroAlign),
        titleSize: pickSafe(item.titleSize, ['small','medium','large'], 'large'),
        bodySize: pickSafe(item.bodySize, ['small','medium','large'], 'medium'),
        bold: false,
        underline: false,
        overlay: true,
        overlayColor: '#000000',
        overlayOpacity: 38,
        height: pickSafe(item.height, ['small','medium','large'], defaults.heroHeight),
      });
    }

    if (item.type === 'text') {
      return block('text', {
        title: item.title || '소개',
        body: item.body || '',
        layout: pickSafe(item.layout, ['plain','card','notice'], defaults.textLayout),
        align: pickSafe(item.align, ['left','center','right'], 'left'),
        size: pickSafe(item.size, ['small','medium','large'], 'medium'),
        bold: false,
        underline: false,
      });
    }

    if (item.type === 'map') {
      return block('map', {
        placeName: item.placeName || item.title || '오시는 길',
        title: item.placeName || item.title || '오시는 길',
        address: item.address || '',
        detailAddress: item.detailAddress || '',
        phone: item.phone || '',
        parkingText: item.parkingText || '',
        mapMode: pickSafe(item.mapMode, ['google_embed','osm_fallback'], 'google_embed'),
      });
    }

    if (item.type === 'faq') {
      return block('faq', {
        title: item.title || '자주 묻는 질문',
        layout: pickSafe(item.layout, ['accordion','card','plain'], 'accordion'),
        firstOpen: item.firstOpen !== false,
        items: normalizeFaqItems(item.items),
      });
    }

    if (item.type === 'links') {
      const items = safeLinkItems(item.items);
      return block('links', {
        title: item.title || '빠른 문의',
        layout: pickSafe(item.layout, ['list','card','carousel'], defaults.linksLayout),
        align: pickSafe(item.align, ['left','center','right'], 'left'),
        newWindow: true,
        items: items.length ? items : [{
          id: uid(),
          emoji: targetEmoji(draft.primaryAction?.target || 'form'),
          iconMode: 'emoji',
          thumb: '',
          label: shortText(draft.primaryAction?.label, '상담하기', 18),
          target: normalizeTargetForDraft(draft.primaryAction?.target || 'form', normalizedDraft.blocks),
          url: cleanUrl(draft.primaryAction?.url),
        }],
      });
    }

    if (item.type === 'timer') {
      return block('timer', {
        label: item.label || '마감까지 남은 시간',
        endAt: '',
        repeatMode: item.repeatMode === 'fixed' ? 'fixed' : 'daily24',
        urgentStyle: pickSafe(item.urgentStyle, ['flip','line','flow','none'], defaults.timerEffect),
        timerTheme: pickSafe(item.timerTheme, ['modern','glass','minimal','accent'], defaults.timerTheme),
        style: pickSafe(item.style, ['plain','accent','card'], defaults.timerStyle),
        align: pickSafe(item.align, ['left','center','right'], 'center'),
        ended: '이벤트가 종료되었습니다.',
        cta: !!item.ctaLabel,
        ctaLabel: item.ctaLabel || draft.primaryAction?.label || '상담 신청',
        ctaTarget: item.ctaTarget || draft.primaryAction?.target || 'form',
        ctaUrl: item.ctaUrl || draft.primaryAction?.url || '',
      });
    }

    if (item.type === 'activity') {
      return block('activity', {
        title: item.title || '실시간 접수현황',
        mode: item.mode === 'count' ? 'count' : 'feed',
        dataSource: 'sample',
        sampleKind: pickSafe(item.sampleKind, ['consult','reservation','both'], 'both'),
        style: pickSafe(item.style, ['minimal','glass','dark'], defaults.activityStyle),
        animation: 'stack',
        align: pickSafe(item.align, ['left','center','right'], 'left'),
        baseCount: clampNumber(item.baseCount, 3, 99, 12),
      });
    }

    if (item.type === 'form') {
      const qs = Array.isArray(item.questions) && item.questions.length
        ? ensureLeadQuestions(item.questions)
        : [
            normalizeQuestion({ label: '이름', type: 'name', required: true }),
            normalizeQuestion({ label: '연락처', type: 'phone', required: true }),
            normalizeQuestion({ label: '문의내용', type: 'long', required: false }),
          ];

      return block('form', {
        title: item.title || '상담 신청',
        desc: item.desc || '정보를 남겨주시면 확인 후 연락드립니다.',
        style: pickSafe(item.style, ['card','line','soft','minimal'], defaults.formStyle),
        submit: item.submit || '신청하기',
        successTitle: item.successTitle || '상담 신청 완료',
        success: item.success || '상담 신청이 접수되었습니다.',
        privacy: '개인정보 수집 및 이용에 동의합니다.',
        privacyRequired: true,
        privacyDetail: '수집 항목: 이름, 연락처, 문의내용\n이용 목적: 상담 안내 및 문의 응대\n보관 기간: 상담 종료 후 내부 기준에 따라 보관',
        inputStyle: pickSafe(item.inputStyle, ['round','box','underline'], defaults.inputStyle),
        buttonStyle: pickSafe(item.buttonStyle, ['solid','round','line'], defaults.buttonStyle),
        buttonHover: pickSafe(item.buttonHover, ['fill','slide','zoom'], defaults.buttonHover),
        spacing: pickSafe(item.spacing, ['compact','normal','wide'], 'normal'),
        radiusStyle: 'round',
        textAlign: pickSafe(item.textAlign, ['left','center','right'], 'left'),
        buttonColorMode: 'theme',
        buttonColor: '#111827',
        buttonTextColor: '#ffffff',
        buttonHoverColorMode: 'theme',
        buttonHoverColor: '#2563eb',
        duplicatePhone: 'allow',
        duplicateEmail: 'off',
        duplicateWindow: '1d',
        questions: qs,
      });
    }

    if (item.type === 'reservation') {
      return block('reservation', {
        title: item.title || '방문상담 예약',
        desc: item.desc || '희망 일정을 선택해주세요.',
        weekdayMode: 'custom',
        weekdays: normalizeWeekdays(item.weekdays),
        start: normalizeTime(item.start, '10:00'),
        end: normalizeTime(item.end, '18:00'),
        interval: clampNumber(item.interval, 10, 120, 30),
        duplicatePhone: 'block',
        duplicateWindow: '1d',
        fields: { name: true, phone: true },
        required: { name: true, phone: true },
        customFields: normalizeReservationFields(item.customFields),
        style: pickSafe(item.style, ['card','line','soft','minimal'], defaults.formStyle),
        inputStyle: pickSafe(item.inputStyle, ['round','box','underline'], defaults.inputStyle),
        buttonStyle: pickSafe(item.buttonStyle, ['solid','round','line'], defaults.buttonStyle),
        buttonHover: pickSafe(item.buttonHover, ['fill','slide','zoom'], defaults.buttonHover),
        textAlign: pickSafe(item.textAlign, ['left','center','right'], 'left'),
        titleSize: pickSafe(item.titleSize, ['small','medium','large'], 'medium'),
        bodySize: pickSafe(item.bodySize, ['small','medium','large'], 'medium'),
        success: item.success || '방문예약 신청이 접수되었습니다.',
        buttonColorMode: 'theme',
        buttonColor: '#111827',
        buttonTextColor: '#ffffff',
        buttonHoverColorMode: 'theme',
        buttonHoverColor: '#2563eb',
      });
    }

    if (item.type === 'spacer') return block('spacer', { height: Number(item.height || 32) });
    if (item.type === 'divider') return block('divider', { style: 'solid', width: 100, thickness: 1, color: '#E2E8F0', marginY: 24, align: 'center' });
    if (item.type === 'image') return block('image', { mode: 'single', image: item.image || '', gallery: (item.gallery || []).slice(0, 4), galleryLayout: 'slide', imageDisplay: 'original', imageHeightPx: 260, imageX: 50, imageY: 50, rounded: true, autoplay: false, interval: 5, galleryShowArrows: true, galleryShowDots: true, caption: item.caption || '' });

    return block('text', { title: '섹션', body: '', layout: 'card', align: 'left', size: 'medium' });
  });
}

function normalizeDraftTheme(currentTheme = {}, draft = {}) {
  const defaults = templateDefaults(draft.templateStyle || 'trust');
  const theme = draft.theme || {};
  const bgMode = pickSafe(theme.bgMode, ['solid','gradient'], defaults.bgMode);
  const accent = safeColor(theme.accentColor, defaults.accent);
  const bgSolid = safeColor(theme.bgColor, defaults.bgSolid);
  const gradientFrom = safeColor(theme.gradientFrom, defaults.gradientFrom);
  const gradientTo = safeColor(theme.gradientTo, defaults.gradientTo);
  const card = safeColor(theme.cardColor, defaults.card);
  const text = safeColor(theme.textColor, defaults.text);
  const animType = ({ rise: 'up' }[theme.animation] || theme.animation || defaults.animType);

  return {
    ...currentTheme,
    accent,
    bgMode,
    bg: bgSolid,
    bgSolid,
    gradientFrom,
    gradientTo,
    gradientRatio: clampNumber(theme.gradientRatio, 0, 100, currentTheme.gradientRatio ?? 50),
    card,
    text,
    radius: clampNumber(theme.radius, 16, 32, defaults.radius),
    buttonEffect: pickSafe(theme.buttonEffect, ['fill','shine','burst'], defaults.buttonEffect),
    animOn: true,
    animType: pickSafe(animType, ['fade','up','scale'], defaults.animType),
  };
}

function brandNameFromDraft(draft = {}) {
  const fallback = String(draft.pageTitle || '랜딩페이지').replace(/랜딩|페이지|상담|예약/g, '').trim() || draft.pageTitle || 'DB';
  return shortText(draft.brandName, fallback, 10);
}

function targetForType(blocks = [], type) {
  const found = blocks.find((blockItem) => blockItem.type === type);
  return found?.id ? `block:${found.id}` : type;
}

function deriveTopMenus(blocks = []) {
  const has = (type) => blocks.some((blockItem) => blockItem.type === type);
  const candidates = [
    has('hero') && { label: '소개', target: targetForType(blocks, 'hero') },
    has('text') && { label: '핵심', target: targetForType(blocks, 'text') },
    has('links') && { label: '문의', target: targetForType(blocks, 'links') },
    has('reservation') && { label: '예약', target: targetForType(blocks, 'reservation') },
    has('form') && { label: '신청', target: targetForType(blocks, 'form') },
    has('map') && { label: '위치', target: targetForType(blocks, 'map') },
    has('faq') && { label: 'FAQ', target: targetForType(blocks, 'faq') },
  ].filter(Boolean);

  return candidates.slice(0, 5).map((menu) => ({ id: uid(), ...menu, url: '' }));
}

function primaryActionButton(draft = {}, blocks = []) {
  const action = draft.primaryAction || {};
  const target = String(action.target || '').trim();
  const label = shortText(action.label, target === 'reservation' ? '예약하기' : '상담하기', 9);
  const url = cleanUrl(action.url);
  if (target === 'phone' && /^tel:/i.test(url)) return { id: uid(), enabled: true, icon: '📞', label, target: 'phone', url };
  if (target === 'url' && /^https?:\/\//i.test(url)) return { id: uid(), enabled: true, icon: '↗', label, target: 'url', url };
  const blockTarget = normalizeTargetForDraft(target || 'form', blocks);
  return { id: uid(), enabled: true, icon: targetEmoji(blockTarget), label, target: blockTarget, url: '' };
}

function deriveBottomButtons(draft = {}, blocks = []) {
  const buttons = [primaryActionButton(draft, blocks)];
  const pushBlock = (type, label, icon) => {
    if (!blocks.some((blockItem) => blockItem.type === type)) return;
    if (buttons.some((button) => button.target === targetForType(blocks, type))) return;
    buttons.push({ id: uid(), enabled: true, icon, label, target: targetForType(blocks, type), url: '' });
  };

  pushBlock('reservation', '예약', '📅');
  pushBlock('form', '상담', '💬');

  const phoneLink = blocks
    .filter((blockItem) => blockItem.type === 'links')
    .flatMap((blockItem) => blockItem.s?.items || [])
    .find((item) => item.target === 'phone' && /^tel:/i.test(item.url || ''));
  if (phoneLink && buttons.length < 3) {
    buttons.push({ id: uid(), enabled: true, icon: phoneLink.emoji || '📞', label: shortText(phoneLink.label, '전화', 8), target: 'phone', url: phoneLink.url });
  }

  return buttons.slice(0, 3);
}

function validateAppliedAiPage(page = {}) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  const visibleBlocks = blocks.filter((blockItem) => blockItem.visible !== false);
  const issues = [];
  const hasTarget = (target = '') => {
    const raw = String(target || '').trim();
    if (!raw) return false;
    if (['phone', 'url'].includes(raw)) return true;
    if (raw.startsWith('block:')) return blocks.some((blockItem) => blockItem.id === raw.slice(6));
    return blocks.some((blockItem) => blockItem.type === raw);
  };

  for (const blockItem of visibleBlocks) {
    const s = blockItem.s || {};
    if (['hero', 'text'].includes(blockItem.type) && !String(s.title || '').trim() && !String(s.body || '').trim()) {
      issues.push('빈 제목/본문 블록이 포함되어 있습니다.');
    }
    if (blockItem.type === 'links') {
      const items = Array.isArray(s.items) ? s.items : [];
      if (!items.length) issues.push('문의 링크 블록에 버튼이 없습니다.');
      if (items.some((item) => !String(item.label || '').trim() || !hasTarget(item.target))) {
        issues.push('문의 링크에 연결되지 않는 버튼이 있습니다.');
      }
    }
    if (blockItem.type === 'map' && !String(s.address || '').trim() && !String(s.placeName || s.title || '').trim()) {
      issues.push('지도 블록에 장소 정보가 없습니다.');
    }
  }

  const topnav = visibleBlocks.find((blockItem) => blockItem.type === 'topnav');
  if (topnav) {
    const menus = Array.isArray(topnav.s?.menus) ? topnav.s.menus : [];
    if (menus.length && menus.some((menu) => !String(menu.label || '').trim() || !hasTarget(menu.target))) {
      issues.push('상단 메뉴에 연결되지 않는 항목이 있습니다.');
    }
  }

  const bottombar = visibleBlocks.find((blockItem) => blockItem.type === 'bottombar');
  if (bottombar) {
    const buttons = Array.isArray(bottombar.s?.buttons) ? bottombar.s.buttons.filter((button) => button.enabled !== false) : [];
    if (!buttons.length) issues.push('하단 버튼이 비어 있습니다.');
    if (buttons.some((button) => !String(button.label || '').trim() || !hasTarget(button.target))) {
      issues.push('하단 버튼에 연결되지 않는 항목이 있습니다.');
    }
  }

  return [...new Set(issues)];
}

function applyFixedBlocks(blocks = [], generatedBlocks = [], draft = {}, options = {}) {
  if (options.mode !== 'replace' || options.updateFixed === false) return blocks;
  const brandName = brandNameFromDraft(draft);
  const menus = deriveTopMenus(generatedBlocks);
  const bottomButtons = deriveBottomButtons(draft, generatedBlocks);

  return blocks.map((blockItem) => {
    if (blockItem.type === 'topnav') {
      return {
        ...blockItem,
        s: {
          ...blockItem.s,
          logoType: blockItem.s?.logoType || 'text',
          logoText: brandName,
          menus: menus.length ? menus : blockItem.s?.menus,
        },
      };
    }

    if (blockItem.type === 'bottombar') {
      return {
        ...blockItem,
        s: {
          ...blockItem.s,
          count: Math.max(1, Math.min(3, bottomButtons.length || 1)),
          buttons: bottomButtons.length ? bottomButtons : blockItem.s?.buttons,
        },
      };
    }

    return blockItem;
  });
}

export function applyAiDraftToPage(page, draft, options = {}) {
  const mode = options.mode === 'append' ? 'append' : 'replace';
  const generatedBlocks = aiDraftToBlocks(draft);
  const blocks = page.blocks || [];
  const fixedBlocks = applyFixedBlocks(
    blocks.filter((b) => ['topnav','bottombar','footer'].includes(b.type)),
    generatedBlocks,
    draft,
    { mode, updateFixed: options.updateFixed },
  );
  const topnav = fixedBlocks.filter((b) => b.type === 'topnav');
  const bottom = fixedBlocks.filter((b) => b.type === 'bottombar');
  const footer = fixedBlocks.filter((b) => b.type === 'footer');
  const content = blocks.filter((b) => !['topnav','bottombar','footer'].includes(b.type));

  const nextContent = mode === 'append'
    ? [...content, ...generatedBlocks]
    : generatedBlocks;

  const nextPage = {
    ...page,
    title: mode === 'replace' ? (draft.pageTitle || page.title) : page.title,
    theme: mode === 'replace' && options.updateTheme !== false ? normalizeDraftTheme(page.theme, draft) : page.theme,
    blocks: [
      ...topnav,
      ...nextContent,
      ...bottom,
      ...footer,
    ],
  };
  const issues = validateAppliedAiPage(nextPage);
  if (issues.length) {
    throw new Error(`AI 초안 적용 결과를 확인해주세요: ${issues.slice(0, 3).join(' ')}`);
  }
  return nextPage;
}
