const PLACEHOLDER_TEXT = new Set([
  'DB',
  '상담 DB 랜딩페이지',
  '샘플컴퍼니',
  '대표자명',
  '010-0000-0000',
  '01000000000',
  'my-page',
]);

function meaningful(value = '') {
  const text = String(value || '').trim();
  return !!text && !PLACEHOLDER_TEXT.has(text);
}

function visibleBlocks(page = {}) {
  return (Array.isArray(page?.blocks) ? page.blocks : []).filter((block) => block?.visible !== false);
}

function validTarget(target = '', blocks = []) {
  const raw = String(target || '').trim();
  if (!raw) return false;
  if (raw === 'phone' || raw === 'url') return true;
  if (raw.startsWith('block:')) return blocks.some((block) => block.id === raw.slice(6));
  return blocks.some((block) => block.type === raw || block.id === raw);
}

function hasConversionAction(blocks = []) {
  const links = blocks.filter((block) => block.type === 'links');
  if (links.some((block) => (block.s?.items || []).some((item) => meaningful(item?.label) && validTarget(item?.target, blocks)))) return true;

  const bottombar = blocks.find((block) => block.type === 'bottombar');
  if ((bottombar?.s?.buttons || []).some((button) => button?.enabled !== false && meaningful(button?.label) && validTarget(button?.target, blocks))) return true;

  return blocks.some((block) => ['form', 'reservation'].includes(block.type));
}

function hasUsefulInquiryFields(blocks = []) {
  const form = blocks.find((block) => block.type === 'form');
  if (form) {
    const questions = Array.isArray(form.s?.questions) ? form.s.questions : [];
    const contact = questions.some((question) => ['phone', 'email'].includes(question?.type) || /연락처|전화|이메일/.test(String(question?.label || '')));
    const detail = questions.some((question) => !['name', 'phone', 'email'].includes(question?.type));
    if (questions.length >= 3 && contact && detail) return true;
  }

  const reservation = blocks.find((block) => block.type === 'reservation');
  if (reservation) {
    const fields = Array.isArray(reservation.s?.customFields) ? reservation.s.customFields : [];
    const hasBaseContact = reservation.s?.fields?.phone !== false;
    if (hasBaseContact && fields.some((field) => meaningful(field?.label))) return true;
  }

  return false;
}

export function buildPublishChecklist(page = {}) {
  const blocks = visibleBlocks(page);
  const hero = blocks.find((block) => block.type === 'hero');
  const topnav = blocks.find((block) => block.type === 'topnav');
  const footer = blocks.find((block) => block.type === 'footer');

  const items = [
    {
      id: 'brand',
      label: '브랜드',
      ok: meaningful(page.title) || meaningful(topnav?.s?.logoText),
    },
    {
      id: 'hero',
      label: '핵심 문구',
      ok: meaningful(hero?.s?.title) && meaningful(hero?.s?.body),
    },
    {
      id: 'action',
      label: '문의 행동',
      ok: hasConversionAction(blocks),
    },
    {
      id: 'fields',
      label: '문의 항목',
      ok: hasUsefulInquiryFields(blocks),
    },
    {
      id: 'footer',
      label: '연락처/사업자',
      ok: meaningful(footer?.s?.company)
        && [footer?.s?.phone, footer?.s?.address, footer?.s?.biz].some(meaningful),
    },
    {
      id: 'url',
      label: '공개 URL',
      ok: meaningful(page.slug),
    },
  ];

  const readyCount = items.filter((item) => item.ok).length;
  return {
    items,
    readyCount,
    total: items.length,
    ready: readyCount === items.length,
    missing: items.filter((item) => !item.ok),
  };
}
