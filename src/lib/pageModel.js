import { SINGLETON_BLOCK_TYPES } from '../config/blockTypes.js';
import { isClientAiKeyStorageEnabled } from '../config/runtimeConfig.js';
import { normalizeButtons } from './blockButtons.js';
import { linkThumbnailFromUrl } from './linkPreview.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const ANCHOR_BASE = {
  topnav: 'menu',
  hero: 'hero',
  image: 'image',
  text: 'text',
  cards: 'cards',
  links: 'links',
  download: 'download',
  schedule: 'schedule',
  map: 'map',
  faq: 'faq',
  timer: 'timer',
  activity: 'live',
  spacer: 'space',
  divider: 'line',
  code: 'code',
  search: 'search',
  form: 'form',
  reservation: 'reservation',
  bottombar: 'bottom',
  footer: 'footer',
};

const defaultPage = {
  title: '상담 DB 랜딩페이지',
  slug: 'my-page',
  theme: { accent: '#111827', bg: '#F5F7FA', bgSolid: '#F5F7FA', gradientFrom: '#F5F7FA', gradientTo: '#EAF2FF', gradientRatio: 50, card: '#FFFFFF', text: '#111827', radius: 24, font: 'modern', fontFamily: 'pretendard', bgMode: 'solid', bgPreset: 'gray', bgGradient: 'custom', bgImage: '', bgImageFit: 'cover', bgImagePosition: 'center', bgOverlay: true, bgOverlayColor: '#F5F7FA', bgOverlayOpacity: 72, bgEffect: 'none', bgEffectOpacity: 45, buttonEffect: 'fill', animOn: false, animType: 'fade', animPlayback: 'once', animSpeed: 'normal', animDelay: 'none' },
  meta: { title: '', desc: '', favicon: '', og: '', gtm: '', ga4: '', googleAdsTag: '', pixel: '', naver: '', kakao: '', console: '', ads: '', naverWebmaster: '' },
  ai: { enabled: false, apiKey: '', model: 'gpt-4o-mini', lastTestStatus: 'idle', lastTestMessage: '', updatedAt: '', draftInput: null },
  integrations: {
    internal: { enabled: true },
    google: { enabled: false, connected: false, email: '', sheetId: '', sheetName: '접수함' },
    email: { enabled: false, to: '', consult: true, reservation: true },
    webhook: { enabled: false, url: '', service: 'custom' },
    automation: { enabled: false, service: 'make', url: '' },
    sms: { enabled: false, adminPhone: '', customerNotice: false, reservationReminder: false },
    calendar: { enabled: false, provider: 'google', connected: false, calendarName: '' },
    sheets: {
      provider: 'google_sheets',
      mode: 'webhook',
      enabled: false,
      status: 'disconnected',
      url: '',
      webhookUrl: '',
      spreadsheetId: '',
      sheetName: '접수함',
      connectedEmail: '',
      accessTokenRef: '',
      refreshTokenRef: '',
      lastSyncAt: '',
      lastError: '',
      notifyEmail: '',
      emailEnabled: false,
    },
    conversion: { enabled: true, dataLayer: true, metaPixel: false, googleAds: false, naver: false, kakao: false },
  },
  blocks: [
    {
      id: uid(), type: 'topnav', visible: true,
      s: { logoType: 'text', logoText: 'DB', logoImage: '', logoStyle: 'plain', logoSize: 'medium', logoColor: '#111827', logoTextColor: '#111827', bg: 'white', barBgColor: '', align: 'left', menuStyle: 'pill', menuSize: 'medium', menuBgColor: '', menuTextColor: '', menuHoverColor: '', menuHoverTextColor: '', sticky: true, menus: [
        { id: uid(), label: '소개', target: 'hero', url: '' }, { id: uid(), label: '상담', target: 'form', url: '' }, { id: uid(), label: '예약', target: 'reservation', url: '' },
      ] },
    },
    {
      id: uid(), type: 'hero', visible: true,
      s: { title: '모바일 랜딩을\n쉽고 예쁘게', body: '필요한 내용만 입력하면 모바일 화면에 맞춰 정리됩니다.', image: '', imageMode: 'top', imageFit: 'contain', imageHeightPx: 320, fullText: true, align: 'left', titleSize: 'large', bodySize: 'medium', bold: false, underline: false, overlay: true, overlayColor: '#000000', overlayOpacity: 38, height: 'medium' },
    },
    { id: uid(), type: 'text', visible: true, s: { title: '제목과 내용만 넣어도 충분합니다.', body: '디자인 옵션은 필요할 때만 열어서 바꿀 수 있습니다.', layout: 'card', align: 'left', size: 'medium', bold: false, underline: false } },
    { id: uid(), type: 'cards', visible: true, s: { title: '핵심 안내', desc: '중요한 내용을 카드로 정리합니다.', layout: 'grid', tone: 'soft', columns: 2, items: [
      { id: uid(), eyebrow: '01', title: '첫 번째 카드', body: '핵심 내용을 짧게 입력하세요.' },
      { id: uid(), eyebrow: '02', title: '두 번째 카드', body: '사용자가 바로 이해할 수 있게 정리하세요.' },
    ] } },
    { id: uid(), type: 'image', visible: true, s: { mode: 'single', image: '', gallery: [], galleryLayout: 'slide', imageDisplay: 'original', imageHeightPx: 260, imageX: 50, imageY: 50, rounded: true, autoplay: false, interval: 5, galleryShowArrows: true, galleryShowDots: true, caption: '' } },
    { id: uid(), type: 'links', visible: true, s: { title: '빠른 문의', layout: 'list', align: 'left', newWindow: true, items: [
      { id: uid(), emoji: '💬', iconMode: 'emoji', thumb: linkThumbnailFromUrl('https://open.kakao.com/'), label: '카카오톡 문의', target: 'url', url: 'https://open.kakao.com/' },
      { id: uid(), emoji: '📞', iconMode: 'emoji', thumb: '', label: '전화 문의', target: 'phone', url: 'tel:01000000000' },
    ] } },
    { id: uid(), type: 'schedule', visible: true, s: { title: '일정 안내', date: '2026-10-24', body: '오후 12시 30분\n라움 아트센터 2층 마제스틱홀', monthLabel: '', highlightColor: '#8AA2C8', cardBgColor: '', textColor: '', align: 'center' } },
    { id: uid(), type: 'timer', visible: true, s: { label: '혜택 마감까지', endAt: '', repeatMode: 'fixed', urgentStyle: 'flip', timerTheme: 'modern', style: 'accent', align: 'center', ended: '이벤트가 종료되었습니다.', cta: false, ctaLabel: '상담 신청', ctaTarget: 'form', ctaUrl: '' } },
    { id: uid(), type: 'form', visible: true, s: { title: '상담 신청', desc: '정보를 남겨주시면 확인 후 연락드립니다.', style: 'card', submit: '신청하기', successTitle: '상담 신청 완료', success: '상담 신청이 접수되었습니다.', privacy: '개인정보 수집 및 이용에 동의합니다.', privacyRequired: true, privacyDetail: '수집 항목: 이름, 연락처, 문의내용\n이용 목적: 상담 안내 및 문의 응대\n보관 기간: 상담 종료 후 내부 기준에 따라 보관', inputStyle: 'round', buttonStyle: 'solid', spacing: 'normal', radiusStyle: 'round', buttonColorMode: 'theme', buttonColor: '#111827', buttonTextColor: '#ffffff', buttonHoverColorMode: 'theme', buttonHoverColor: '#2563eb', duplicatePhone: 'allow', duplicateEmail: 'off', duplicateWindow: '1d', questions: [
      { id: uid(), label: '이름', type: 'short', required: true, options: [] },
      { id: uid(), label: '연락처', type: 'phone', required: true, options: [] },
      { id: uid(), label: '문의내용', type: 'long', required: false, options: [] },
    ] } },
    { id: uid(), type: 'reservation', visible: true, s: { title: '방문상담 예약', desc: '희망 일정을 선택해주세요.', weekdayMode: 'weekday', weekdays: ['mon','tue','wed','thu','fri'], start: '10:00', end: '18:00', interval: 30, duplicatePhone: 'block', duplicateWindow: '1d', fields: { name: true, phone: true }, required: { name: true, phone: true }, customFields: [], style: 'card', inputStyle: 'round', textAlign: 'left', titleSize: 'medium', bodySize: 'medium', buttonStyle: 'solid', buttonHover: 'fill', spacing: 'normal', radiusStyle: 'round', success: '방문예약 신청이 접수되었습니다.', buttonColorMode: 'theme', buttonColor: '#111827', buttonTextColor: '#ffffff', buttonHoverColorMode: 'theme', buttonHoverColor: '#2563eb' } },
    { id: uid(), type: 'bottombar', visible: true, s: { count: 2, style: 'pill', color: 'dark', mobileOnly: true, showAfter: false, buttonColorMode: 'theme', buttonColor: '#111827', buttonTextColor: '#ffffff', buttons: [
      { id: uid(), enabled: true, icon: '💬', label: '상담', target: 'form', url: '' }, { id: uid(), enabled: true, icon: '📅', label: '예약', target: 'reservation', url: '' }, { id: uid(), enabled: true, icon: '📞', label: '전화', target: 'phone', url: 'tel:01000000000' },
    ] } },
    { id: uid(), type: 'footer', visible: true, s: { company: '샘플컴퍼니', owner: '대표자명', phone: '010-0000-0000', email: '', address: '', biz: '', privacyUrl: '', termsUrl: '', align: 'center', bg: 'plain' } },
  ],
};

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function cleanSerializable(value, seen = new WeakSet()) {
  if (value == null) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'function' || type === 'symbol' || type === 'bigint') return undefined;
  if (type !== 'object') return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => cleanSerializable(item, seen)).filter((item) => item !== undefined);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith('__react') && !['stateNode', 'constructor', '_owner', '_store'].includes(key))
      .map(([key, item]) => [key, cleanSerializable(item, seen)])
      .filter(([, item]) => item !== undefined),
  );
}
function slugifyAnchor(value, fallback = 'section') {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return (clean || fallback).slice(0, 48);
}

function ensureUniqueAnchors(blocks = []) {
  const used = new Set();
  return (blocks || []).map((block, index) => {
    const fallback = ANCHOR_BASE[block.type] || `section-${index + 1}`;
    const base = slugifyAnchor(block.s?.anchorId || fallback, fallback);
    let next = base;
    let count = 2;
    while (used.has(next)) {
      next = `${base}-${count}`;
      count += 1;
    }
    used.add(next);
    return { ...block, s: { ...(block.s || {}), anchorId: next } };
  });
}

function normalizeIntegrations(integrations = {}) {
  const base = clone(defaultPage.integrations || {});
  const next = {
    ...base,
    ...(integrations || {}),
    internal: { ...base.internal, ...(integrations?.internal || {}) },
    google: { ...base.google, ...(integrations?.google || {}) },
    email: { ...base.email, ...(integrations?.email || {}) },
    webhook: { ...base.webhook, ...(integrations?.webhook || {}) },
    automation: { ...base.automation, ...(integrations?.automation || {}) },
    sms: { ...base.sms, ...(integrations?.sms || {}) },
    calendar: { ...base.calendar, ...(integrations?.calendar || {}) },
    sheets: { ...base.sheets, ...(integrations?.sheets || {}) },
    conversion: { ...base.conversion, ...(integrations?.conversion || {}) },
  };

  next.webhook.format = pickSafe(next.webhook.format || 'json', ['json','nocors'], 'json');
  next.internal.enabled = next.internal.enabled !== false;
  next.google.enabled = !!next.google.enabled;
  next.google.connected = !!next.google.connected;
  next.email.enabled = !!next.email.enabled;
  next.webhook.enabled = !!next.webhook.enabled;
  next.webhook.service = pickSafe(next.webhook.service || 'custom', ['custom','crm','server'], 'custom');
  next.automation.enabled = !!next.automation.enabled;
  next.automation.service = pickSafe(next.automation.service || 'make', ['make','zapier','n8n'], 'make');
  next.sms.enabled = !!next.sms.enabled;
  next.sms.customerNotice = !!next.sms.customerNotice;
  next.sms.reservationReminder = !!next.sms.reservationReminder;
  next.calendar.enabled = !!next.calendar.enabled;
  next.calendar.connected = !!next.calendar.connected;
  next.sheets.enabled = !!next.sheets.enabled;
  next.sheets.provider = 'google_sheets';
  next.sheets.mode = pickSafe(next.sheets.mode || (next.sheets.webhookUrl || next.sheets.url ? 'webhook' : 'oauth'), ['webhook','oauth'], 'oauth');
  next.sheets.webhookUrl = String(next.sheets.webhookUrl || next.sheets.url || '').trim();
  next.sheets.url = next.sheets.webhookUrl;
  next.sheets.spreadsheetId = String(next.sheets.spreadsheetId || '').trim();
  next.sheets.sheetName = String(next.sheets.sheetName || '접수함').trim() || '접수함';
  next.sheets.connectedEmail = String(next.sheets.connectedEmail || '').trim();
  next.sheets.accessTokenRef = String(next.sheets.accessTokenRef || '').trim();
  next.sheets.refreshTokenRef = String(next.sheets.refreshTokenRef || '').trim();
  const sheetsConnected = next.sheets.mode === 'oauth'
    ? !!(next.sheets.connectedEmail && next.sheets.spreadsheetId)
    : !!next.sheets.webhookUrl;
  next.sheets.status = pickSafe(next.sheets.status || (next.sheets.enabled && sheetsConnected ? 'connected' : 'disconnected'), ['disconnected','connected','error'], 'disconnected');
  if (/postJson is not defined|not defined/i.test(String(next.sheets.lastError || ''))) {
    next.sheets.lastError = '';
    if (next.sheets.status === 'error') next.sheets.status = next.sheets.enabled && next.sheets.webhookUrl ? 'connected' : 'disconnected';
  }
  next.sheets.lastSyncAt = String(next.sheets.lastSyncAt || '').trim();
  next.sheets.lastError = String(next.sheets.lastError || '').trim();
  next.sheets.emailEnabled = !!next.sheets.emailEnabled;
  next.conversion.enabled = next.conversion.enabled !== false;

  return next;
}

function normalize(page) {
  const p = { ...clone(defaultPage), ...(page || {}) };
  p.theme = { ...defaultPage.theme, ...(page?.theme || {}) };
  p.meta = { ...defaultPage.meta, ...(page?.meta || {}) };
  p.ai = { ...defaultPage.ai, ...(page?.ai || {}) };
  if (!isClientAiKeyStorageEnabled()) p.ai.apiKey = '';
  p.integrations = normalizeIntegrations(page?.integrations);
  p.blocks = Array.isArray(page?.blocks) && page.blocks.length ? page.blocks : clone(defaultPage.blocks);
  p.blocks = p.blocks.filter((b, idx, arr) => !SINGLETON_BLOCK_TYPES.includes(b.type) || arr.findIndex((x) => x.type === b.type) === idx);
  ['topnav','bottombar','footer'].forEach((type) => {
    if (!p.blocks.some((b) => b.type === type)) {
      const base = clone(defaultPage.blocks.find((b) => b.type === type));
      if (base) p.blocks.push(base);
    }
  });
  p.blocks = p.blocks.map((b) => sanitizeBlock({ ...b, s: { ...(clone(defaultPage.blocks.find((x) => x.type === b.type)?.s || {})), ...(b.s || b.settings || {}) } }));
  p.blocks = ensureUniqueAnchors(p.blocks);
  return p;
}

function normalizePageForSave(page) {
  return cleanSerializable(normalize(page));
}
const BLOCK_SAFE_OPTIONS = {
  topnav: { bg: ['white','transparent','dark'], align: ['left','center','right'], logoType: ['text','image'], logoStyle: ['plain','badge'], logoSize: ['small','medium','large'], menuStyle: ['pill','text','outline'], menuSize: ['small','medium','large'] },
  hero: { imageMode: ['top','background','full'], align: ['left','center','right'], titleSize: ['small','medium','large'], bodySize: ['small','medium','large'], height: ['small','medium','large'] },
  text: { layout: ['plain','card','notice'], align: ['left','center','right'], size: ['small','medium','large'] },
  cards: { layout: ['grid','stack','steps'], tone: ['soft','solid','outline'], align: ['left','center'] },
  image: { mode: ['single','gallery'], galleryLayout: ['slide','grid'], imageDisplay: ['original','fill'] },
  map: { mapMode: ['google_embed','osm_fallback'], height: ['small','medium','large'] },
  faq: { layout: ['accordion','card','plain'] },
  links: { layout: ['list','card','carousel'], align: ['left','center','right'] },
  download: { layout: ['card','list'], align: ['left','center','right'] },
  schedule: { align: ['left','center','right'] },
  timer: { style: ['plain','accent','card'], align: ['left','center','right'], repeatMode: ['fixed','daily24'], urgentStyle: ['flip','line','flow','none'], timerTheme: ['modern','glass','minimal','accent'] },
  activity: { style: ['minimal','glass','dark'], mode: ['feed','count'], dataSource: ['live','sample'], sampleKind: ['consult','reservation','both'], animation: ['stack','none'], align: ['left','center','right'] },
  code: { height: ['auto','small','medium','large'] },
  search: { layout: ['card','bar','minimal'] },
  form: { style: ['card','line','soft','minimal'], inputStyle: ['round','box','underline'], textAlign: ['left','center','right'], buttonStyle: ['solid','round','line'], buttonHover: ['fill','slide','zoom'], spacing: ['compact','normal','wide'], radiusStyle: ['square','round','pill'], duplicatePhone: ['allow','warn','block'], duplicateEmail: ['off','warn','block'], duplicateWindow: ['1d','3d','7d','30d'] },
  reservation: { style: ['card','line','soft','minimal'], inputStyle: ['round','box','underline'], textAlign: ['left','center','right'], titleSize: ['small','medium','large'], bodySize: ['small','medium','large'], buttonStyle: ['solid','round','line'], buttonHover: ['fill','slide','zoom'], spacing: ['compact','normal','wide'], radiusStyle: ['square','round','pill'], duplicatePhone: ['allow','warn','block'], duplicateWindow: ['1d','3d','7d','30d'] },
  bottombar: { style: ['pill','box'], color: ['dark','accent','light'] },
  footer: { align: ['left','center','right'], bg: ['plain','soft','dark'] },
};

function pickSafe(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? number : fallback;
  return Math.max(min, Math.min(max, safeNumber));
}

function migrateButtonColorMode(s, defaultButton = '#111827', defaultHover = '#2563eb') {
  s.buttonColorMode = pickSafe(
    s.buttonColorMode || (s.buttonColor && s.buttonColor !== defaultButton ? 'custom' : 'theme'),
    ['theme','custom'],
    'theme',
  );
  s.buttonHoverColorMode = pickSafe(
    s.buttonHoverColorMode || (s.buttonHoverColor && s.buttonHoverColor !== defaultHover ? 'custom' : 'theme'),
    ['theme','custom'],
    'theme',
  );
}

function sanitizeBlock(block) {
  const defaults = clone(defaultPage.blocks.find((x) => x.type === block?.type)?.s || {});
  const s = { ...defaults, ...(block?.s || block?.settings || {}) };
  const opts = BLOCK_SAFE_OPTIONS[block?.type] || {};

  Object.entries(opts).forEach(([key, list]) => {
    s[key] = pickSafe(s[key], list, defaults[key] ?? list[0]);
  });
  if (['text','cards','map','faq','links','download','schedule','timer','activity','code','search'].includes(block?.type)) {
    s.bgEnabled = !!s.bgEnabled;
    s.bgColor = s.bgColor || '#FFFFFF';
    s.paddingY = clampNumber(s.paddingY, 0, 44, 22);
    s.marginY = clampNumber(s.marginY, 0, 48, 24);
    s.radiusStyle = pickSafe(s.radiusStyle || 'round', ['square','round'], 'round');
    s.shadowEnabled = !!s.shadowEnabled;
  }

  if (block?.type === 'topnav') {
    s.logoType = pickSafe(s.logoType || 'text', ['text','image'], 'text');
    s.logoStyle = pickSafe(s.logoStyle || 'plain', ['plain','badge'], 'plain');
    s.logoSize = pickSafe(s.logoSize || 'medium', ['small','medium','large'], 'medium');
    s.menuStyle = pickSafe(s.menuStyle || 'pill', ['pill','text','outline'], 'pill');
    s.menuSize = pickSafe(s.menuSize || 'medium', ['small','medium','large'], 'medium');
    s.logoColor = s.logoColor || '#111827';
    s.barBgColor = s.barBgColor || '';
    s.logoTextColor = s.bg === 'dark' && (!s.logoTextColor || s.logoTextColor === '#111827') ? '#ffffff' : (s.logoTextColor || '');
    s.menuBgColor = s.menuBgColor === '#F1F5F9' ? '' : (s.menuBgColor || '');
    s.menuTextColor = s.menuTextColor || (s.menuStyle === 'pill' ? '#111827' : (s.bg === 'dark' ? '#ffffff' : ''));
    s.menuHoverColor = s.menuHoverColor || '';
    s.menuHoverTextColor = s.menuHoverTextColor || '';
    s.sticky = s.sticky !== false;
    s.menus = Array.isArray(s.menus) ? s.menus.slice(0, 5) : [];
  }

  if (block?.type === 'schedule') {
    s.title = s.title ?? '일정 안내';
    s.date = String(s.date || '').slice(0, 10);
    s.body = s.body || s.venue || '';
    s.monthLabel = s.monthLabel || '';
    s.highlightColor = s.highlightColor || '#8AA2C8';
    s.cardBgColor = s.cardBgColor || '';
    s.textColor = s.textColor || s.dayColor || s.weekdayColor || '';
    s.align = pickSafe(s.align || 'center', ['left','center','right'], 'center');
  }

  if (block?.type === 'hero') {
    s.imageMode = pickSafe(s.imageMode || 'top', ['top','background','full'], 'top');
    s.imageFit = pickSafe(s.imageFit || (s.imageMode === 'full' ? 'cover' : 'contain'), ['cover','contain'], s.imageMode === 'full' ? 'cover' : 'contain');
    s.heroBleed = pickSafe(s.heroBleed || 'content', ['content','page'], 'content');
    s.fullText = s.fullText !== false;
    s.overlay = s.overlay !== false;
    s.overlayColor = s.overlayColor || '#000000';
    s.overlayOpacity = Math.max(0, Math.min(85, Number(s.overlayOpacity ?? 38)));
    s.imageHeightPx = Math.max(180, Math.min(720, Number(s.imageHeightPx ?? 320)));
  }

  if (block?.type === 'timer') {
    s.repeatMode = pickSafe(s.repeatMode || 'fixed', ['fixed','daily24'], 'fixed');
    s.urgentStyle = pickSafe(s.urgentStyle || 'flip', ['flip','line','flow','none'], 'flip');
    s.timerTheme = pickSafe(s.timerTheme || 'modern', ['modern','glass','minimal','accent'], 'modern');
    s.floatOnBottom = !!s.floatOnBottom;
    s.floatLabel = s.floatLabel || s.label || '오늘 마감까지';
  }

  if (block?.type === 'activity') {
    s.mode = pickSafe(s.mode || 'feed', ['feed','count'], 'feed');
    s.dataSource = pickSafe(s.dataSource || 'sample', ['live','sample'], 'sample');
    s.sampleKind = pickSafe(s.sampleKind || 'both', ['consult','reservation','both'], 'both');
    s.style = pickSafe(s.style || 'glass', ['minimal','glass','dark'], 'glass');
    s.animation = pickSafe(s.animation || 'stack', ['stack','none'], 'stack');
    s.align = pickSafe(s.align || 'left', ['left','center','right'], 'left');
    s.baseCount = Math.max(0, Math.min(9999, Number(s.baseCount ?? 12)));
  }

  if (block?.type === 'code') {
    s.html = String(s.html || '').slice(0, 40000);
    s.css = String(s.css || '').slice(0, 40000);
    s.js = String(s.js || '').slice(0, 30000);
    s.runJs = !!s.runJs;
    s.height = pickSafe(s.height || 'auto', ['auto','small','medium','large'], 'auto');
  }

  if (block?.type === 'search') {
    s.title = s.title || '페이지 검색';
    s.placeholder = s.placeholder || '찾을 내용을 입력하세요';
    s.buttonLabel = s.buttonLabel || '검색';
    s.emptyText = s.emptyText || '일치하는 내용이 없습니다.';
    s.layout = pickSafe(s.layout || 'card', ['card','bar','minimal'], 'card');
    s.live = s.live !== false;
  }

  if (block?.type === 'text') {
    s.layout = pickSafe(s.layout || 'plain', ['plain','card','notice'], 'plain');
    s.bgEnabled = !!s.bgEnabled;
    s.bgColor = s.bgColor || '#FFFFFF';
    s.padding = clampNumber(s.padding, 0, 48, 14);
    s.marginY = clampNumber(s.marginY, 0, 48, 12);
    s.radius = clampNumber(s.radius, 0, 36, 18);
    s.shadow = !!s.shadow;
    s.spacingPreset = pickSafe(s.spacingPreset || 'normal', ['compact','normal','wide'], 'normal');
    s.radiusPreset = pickSafe(s.radiusPreset || 'medium', ['none','small','medium','large','pill','square','round'], 'medium');
  }

  if (block?.type === 'cards') {
    s.title = s.title || '카드 안내';
    s.desc = s.desc || '';
    s.layout = pickSafe(s.layout || 'grid', ['grid','stack','steps'], 'grid');
    s.tone = pickSafe(s.tone || 'soft', ['soft','solid','outline'], 'soft');
    s.align = pickSafe(s.align || 'left', ['left','center'], 'left');
    s.columns = Math.max(1, Math.min(2, Number(s.columns || 2)));
    s.items = Array.isArray(s.items) ? s.items.map((item, index) => ({
      id: item.id || uid(),
      eyebrow: String(item.eyebrow || `${index + 1}`).slice(0, 24),
      title: item.title || '카드 제목',
      body: item.body || '',
    })).slice(0, 8) : [];
    if (!s.items.length) {
      s.items = [{ id: uid(), eyebrow: '01', title: '카드 제목', body: '내용을 입력하세요.' }];
    }
  }

  if (['links','timer'].includes(block?.type)) {
    s.bgEnabled = !!s.bgEnabled;
    s.bgColor = s.bgColor || '#FFFFFF';
    s.padding = Math.max(0, Math.min(40, Number(s.padding ?? 0)));
    s.marginY = Math.max(0, Math.min(48, Number(s.marginY ?? 12)));
    s.radius = Math.max(0, Math.min(32, Number(s.radius ?? 18)));
    s.shadow = !!s.shadow;
  }

  if (block?.type === 'download') {
    s.title = s.title || '';
    s.desc = s.desc || '';
    s.layout = pickSafe(s.layout || 'card', ['card','list'], 'card');
    s.align = pickSafe(s.align || 'left', ['left','center','right'], 'left');
    s.buttonLabel = s.buttonLabel || '다운로드';
    s.newWindow = s.newWindow !== false;
    const allowedExtensions = ['pdf','ppt','pptx','xls','xlsx'];
    s.items = Array.isArray(s.items) ? s.items.map((item, index) => {
      const extension = String(item.extension || item.ext || '').replace(/^\./, '').toLowerCase();
      const fileName = String(item.fileName || '').slice(0, 140);
      const detectedExtension = extension || String(fileName.split('.').pop() || '').toLowerCase();
      const safeExtension = pickSafe(detectedExtension, allowedExtensions, 'pdf');
      return {
        id: item.id || uid(),
        badge: String(item.badge || safeExtension.toUpperCase()).slice(0, 18),
        title: String(item.title || item.label || `자료 ${index + 1}`).slice(0, 80),
        desc: String(item.desc || item.body || '').slice(0, 180),
        fileName,
        fileUrl: String(item.fileUrl || item.url || '').trim().slice(0, 800),
        extension: safeExtension,
        sizeLabel: String(item.sizeLabel || '').slice(0, 24),
      };
    }).slice(0, 8) : [];
    if (!s.items.length) {
      s.items = [{
        id: uid(),
        badge: 'PDF',
        title: '서비스 제안서',
        desc: '상세 구성과 진행 절차를 확인할 수 있는 자료입니다.',
        fileName: 'proposal.pdf',
        fileUrl: '',
        extension: 'pdf',
        sizeLabel: '20MB 이하',
      }];
    }
  }

  if (block?.type === 'image') {
    s.gallery = Array.isArray(s.gallery) ? s.gallery.slice(0, 4) : [];
    s.galleryLayout = pickSafe(s.galleryLayout || 'slide', ['slide','grid'], 'slide');
    s.imageHeightPx = Math.max(140, Math.min(520, Number(s.imageHeightPx || 260)));
    s.imageX = Math.max(0, Math.min(100, Number(s.imageX ?? 50)));
    s.imageY = Math.max(0, Math.min(100, Number(s.imageY ?? 50)));
    s.marginY = clampNumber(s.marginY, 0, 48, 12);
  }

  if (block?.type === 'map') {
    s.placeName = s.placeName || s.title || '오시는 길';
    s.title = s.placeName;
    s.address = s.address || '';
    s.detailAddress = s.detailAddress || '';
    s.phone = s.phone || '';
    s.parkingText = s.parkingText || '';
    s.mapMode = pickSafe(s.mapMode || 'google_embed', ['google_embed','osm_fallback'], 'google_embed');
  }

  if (block?.type === 'faq') {
    s.title = s.title || '자주 묻는 질문';
    s.items = Array.isArray(s.items) ? s.items.map((item) => ({
      id: item.id || uid(),
      q: item.q || item.question || '질문을 입력하세요',
      a: item.a || item.answer || '답변을 입력하세요',
    })).slice(0, 12) : [];
    if (!s.items.length) {
      s.items = [
        { id: uid(), q: '상담은 어떻게 진행되나요?', a: '신청 정보를 확인한 뒤 담당자가 순서대로 연락드립니다.' },
        { id: uid(), q: '비용은 언제 확인할 수 있나요?', a: '상담 시 조건을 확인한 뒤 안내드립니다.' },
        { id: uid(), q: '방문 예약도 가능한가요?', a: '가능 요일과 시간을 확인한 뒤 예약을 도와드립니다.' },
      ];
    }
    s.firstOpen = s.firstOpen !== false;
  }

  if (block?.type === 'form') {
    s.questions = Array.isArray(s.questions) ? s.questions : [];
    const spacingDefault = { compact: 8, normal: 12, wide: 18 }[s.spacing] || 12;
    s.spacingPx = spacingDefault;
    s.radiusStyle = pickSafe(s.radiusStyle || 'round', ['square','round','pill'], 'round');
    s.textAlign = pickSafe(s.textAlign || s.titleAlign || 'left', ['left','center','right'], 'left');
    s.buttonHover = pickSafe(s.buttonHover || 'fill', ['fill','slide','zoom'], 'fill');
    migrateButtonColorMode(s);
    s.buttonColor = s.buttonColor || '#111827';
    s.buttonTextColor = s.buttonTextColor || '#ffffff';
    s.buttonHoverColor = s.buttonHoverColor || '#2563eb';
    s.questions = s.questions.map((q) => ({
      id: q.id || uid(),
      label: q.label || '질문',
      type: pickSafe(q.type, ['name','phone','email','address','short','long','select','multi'], 'short'),
      required: !!q.required,
      placeholder: q.placeholder || '',
      options: Array.isArray(q.options) ? q.options : [],
    }));
  }

  if (block?.type === 'reservation') {
    s.weekdays = Array.isArray(s.weekdays) ? s.weekdays : [];
    s.weekdayMode = pickSafe(s.weekdayMode || 'custom', ['weekday','everyday','custom'], 'custom');
    s.fields = { name: true, phone: true, ...(s.fields || {}) };
    s.required = { name: true, phone: true, ...(s.required || {}) };
    s.customFields = Array.isArray(s.customFields) ? s.customFields.map((field) => ({
      id: field.id || uid(),
      label: field.label || '추가 항목',
      type: pickSafe(field.type || 'short', ['short','long','select'], 'short'),
      required: !!field.required,
      options: Array.isArray(field.options) ? field.options : [],
    })) : [];
    s.inputStyle = pickSafe(s.inputStyle || 'round', ['round','box','underline'], 'round');
    s.textAlign = pickSafe(s.textAlign || 'left', ['left','center','right'], 'left');
    s.titleSize = pickSafe(s.titleSize || 'medium', ['small','medium','large'], 'medium');
    s.bodySize = pickSafe(s.bodySize || 'medium', ['small','medium','large'], 'medium');
    s.buttonStyle = pickSafe(s.buttonStyle || 'solid', ['solid','round','line'], 'solid');
    s.buttonHover = pickSafe(s.buttonHover || 'fill', ['fill','slide','zoom'], 'fill');
    const reservationSpacingDefault = { compact: 8, normal: 12, wide: 18 }[s.spacing] || 12;
    s.spacingPx = reservationSpacingDefault;
    s.radiusStyle = pickSafe(s.radiusStyle || 'round', ['square','round','pill'], 'round');
    s.marginY = clampNumber(s.marginY, 0, 48, 12);
    migrateButtonColorMode(s);
    s.buttonColor = s.buttonColor || '#111827';
    s.buttonTextColor = s.buttonTextColor || '#ffffff';
    s.buttonHoverColor = s.buttonHoverColor || '#2563eb';
  }

  if (block?.type === 'bottombar') {
    s.count = Math.max(1, Math.min(3, Number(s.count || 1)));
    s.style = pickSafe(s.style, ['pill','box'], 'pill');
    s.color = pickSafe(s.color, ['dark','accent','light'], 'dark');
    migrateButtonColorMode(s);
    s.buttonColor = s.buttonColor || '#111827';
    s.buttonTextColor = s.buttonTextColor || '#ffffff';
    s.timerEnabled = !!s.timerEnabled;
    s.timerLabel = s.timerLabel || '오늘 마감까지';
    s.timerMode = pickSafe(s.timerMode || 'daily24', ['fixed','daily24'], 'daily24');
    s.timerEndAt = s.timerEndAt || '';
    s.timerTheme = pickSafe(s.timerTheme || 'modern', ['modern','glass','minimal','accent'], 'modern');
    s.buttons = normalizeButtons(s.buttons, s.count);
  }

  return {
    id: block?.id || uid(),
    type: block?.type || 'text',
    visible: block?.visible !== false,
    s: cleanSerializable(s) || {},
  };
}

function newBlock(type) {
  if (type === 'spacer') {
    return sanitizeBlock({ id: uid(), type: 'spacer', visible: true, s: { height: 40 } });
  }
  if (type === 'divider') {
    return sanitizeBlock({ id: uid(), type: 'divider', visible: true, s: { style: 'solid', width: 100, thickness: 1, color: '#E2E8F0', marginY: 24, align: 'center' } });
  }
  if (type === 'activity') {
    return sanitizeBlock({ id: uid(), type: 'activity', visible: true, s: { title: '실시간 접수현황', mode: 'feed', dataSource: 'sample', sampleKind: 'both', style: 'glass', animation: 'stack', align: 'left' } });
  }
  if (type === 'cards') {
    return sanitizeBlock({ id: uid(), type: 'cards', visible: true, s: { title: '카드 안내', desc: '', layout: 'grid', tone: 'soft', align: 'left', columns: 2, items: [
      { id: uid(), eyebrow: '01', title: '핵심 카드', body: '중요한 내용을 카드로 보여주세요.' },
      { id: uid(), eyebrow: '02', title: '보조 카드', body: '두 번째 내용을 입력하세요.' },
    ] } });
  }
  if (type === 'download') {
    return sanitizeBlock({ id: uid(), type: 'download', visible: true, s: { title: '', desc: '', layout: 'card', align: 'left', buttonLabel: '다운로드', newWindow: true, items: [
      { id: uid(), badge: 'PDF', title: '서비스 제안서', desc: '상품 소개와 견적 기준을 정리한 자료입니다.', fileName: 'proposal.pdf', fileUrl: '', extension: 'pdf', sizeLabel: '20MB 이하' },
    ] } });
  }
  if (type === 'map') {
    return sanitizeBlock({ id: uid(), type: 'map', visible: true, s: { placeName: '오시는 길', title: '오시는 길', address: '', detailAddress: '', phone: '', parkingText: '', mapMode: 'google_embed' } });
  }
  if (type === 'schedule') {
    return sanitizeBlock({ id: uid(), type: 'schedule', visible: true, s: { title: '일정 안내', date: '2026-10-24', body: '상세 일정을 입력하세요', monthLabel: '', highlightColor: '#8AA2C8', cardBgColor: '', textColor: '', align: 'center' } });
  }
  if (type === 'faq') {
    return sanitizeBlock({ id: uid(), type: 'faq', visible: true, s: { title: '자주 묻는 질문', layout: 'accordion', firstOpen: true, items: [
      { id: uid(), q: '상담은 어떻게 진행되나요?', a: '신청 정보를 확인한 뒤 담당자가 순서대로 연락드립니다.' },
      { id: uid(), q: '비용은 언제 확인할 수 있나요?', a: '상담 시 조건을 확인한 뒤 안내드립니다.' },
      { id: uid(), q: '방문 예약도 가능한가요?', a: '가능 요일과 시간을 확인한 뒤 예약을 도와드립니다.' },
    ] } });
  }
  if (type === 'code') {
    return sanitizeBlock({ id: uid(), type: 'code', visible: true, s: {
      html: '',
      css: '',
      js: '',
      runJs: false,
      height: 'auto',
    } });
  }
  if (type === 'search') {
    return sanitizeBlock({ id: uid(), type: 'search', visible: true, s: {
      title: '페이지 검색',
      placeholder: '찾을 내용을 입력하세요',
      buttonLabel: '검색',
      emptyText: '일치하는 내용이 없습니다.',
      layout: 'card',
      live: true,
    } });
  }
  const b = clone(defaultPage.blocks.find((x) => x.type === type) || defaultPage.blocks[1]);
  b.id = uid();
  return sanitizeBlock(b);
}

export { BLOCK_SAFE_OPTIONS, clone, defaultPage, ensureUniqueAnchors, newBlock, normalize, normalizeIntegrations, normalizePageForSave, pickSafe, sanitizeBlock, slugifyAnchor, uid };


