const BLOCK_TYPE_LABELS = {
  topnav: '상단 메뉴',
  hero: '첫 화면',
  image: '이미지',
  text: '텍스트',
  map: '지도',
  faq: 'FAQ',
  links: '링크',
  timer: '타이머',
  activity: '접수 현황',
  spacer: '여백',
  divider: '구분선',
  code: '커스텀 코드',
  search: '검색',
  form: '상담 폼',
  reservation: '예약 폼',
  bottombar: '하단바',
  footer: '푸터',
};

const META_FIELDS = [
  ['title', '메타 제목'],
  ['desc', '메타 설명'],
  ['favicon', '파비콘'],
  ['og', '공유 이미지'],
  ['gtm', 'GTM'],
  ['ga4', 'GA4'],
  ['googleAdsTag', 'Google Ads 태그'],
  ['pixel', 'Meta Pixel'],
  ['naver', '네이버 전환'],
  ['naverWebmaster', '네이버 웹마스터'],
  ['kakao', '카카오'],
  ['console', '구글 콘솔'],
  ['ads', 'Google Ads'],
];

function blocksOf(page = {}) {
  return Array.isArray(page.blocks) ? page.blocks : [];
}

function stableJson(value) {
  return JSON.stringify(sortJson(value ?? null));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortJson(value[key]);
    return acc;
  }, {});
}

function blockLabel(block = {}) {
  const type = BLOCK_TYPE_LABELS[block.type] || block.type || '블록';
  const title = block.s?.title || block.s?.label || block.anchor || '';
  return title ? `${type}(${title})` : type;
}

function blockKey(block = {}) {
  return String(block.id || `${block.type || 'block'}:${block.anchor || block.s?.title || ''}`);
}

function changedMetaFields(current = {}, candidate = {}) {
  return META_FIELDS
    .filter(([key]) => String(current.meta?.[key] || '') !== String(candidate.meta?.[key] || ''))
    .map(([, label]) => label);
}

function addItem(items, tone, label, detail = '') {
  items.push({
    key: `${tone}:${label}:${detail || items.length}`,
    tone,
    label,
    detail,
  });
}

export function buildPageRevisionDiff(current = {}, candidate = {}) {
  const items = [];
  const currentBlocks = blocksOf(current);
  const candidateBlocks = blocksOf(candidate);
  const currentMap = new Map(currentBlocks.map((block) => [blockKey(block), block]));
  const candidateMap = new Map(candidateBlocks.map((block) => [blockKey(block), block]));

  if (String(current.title || '') !== String(candidate.title || '')) {
    addItem(items, 'changed', '페이지명 변경', `${current.title || '-'} -> ${candidate.title || '-'}`);
  }

  if (String(current.slug || '') !== String(candidate.slug || '')) {
    addItem(items, 'changed', '페이지 주소 변경', `/${current.slug || 'my-page'} -> /${candidate.slug || 'my-page'}`);
  }

  if (currentBlocks.length !== candidateBlocks.length) {
    addItem(items, 'changed', '블록 수 변경', `${currentBlocks.length}개 -> ${candidateBlocks.length}개`);
  }

  const addedBlocks = candidateBlocks.filter((block) => !currentMap.has(blockKey(block)));
  const removedBlocks = currentBlocks.filter((block) => !candidateMap.has(blockKey(block)));
  const changedBlocks = candidateBlocks.filter((block) => {
    const currentBlock = currentMap.get(blockKey(block));
    return currentBlock && stableJson(currentBlock) !== stableJson(block);
  });

  if (addedBlocks.length) {
    addItem(items, 'added', '추가된 블록', addedBlocks.map(blockLabel).join(', '));
  }

  if (removedBlocks.length) {
    addItem(items, 'removed', '삭제된 블록', removedBlocks.map(blockLabel).join(', '));
  }

  if (changedBlocks.length) {
    addItem(items, 'changed', '수정된 블록', changedBlocks.map(blockLabel).slice(0, 8).join(', '));
  }

  const metaFields = changedMetaFields(current, candidate);
  if (metaFields.length) {
    addItem(items, 'changed', '검색/추적 설정 변경', metaFields.join(', '));
  }

  if (stableJson(current.theme || {}) !== stableJson(candidate.theme || {})) {
    addItem(items, 'changed', '디자인 테마 변경', '색상, 폰트, 배경 설정이 달라졌습니다.');
  }

  if (stableJson(current.integrations || {}) !== stableJson(candidate.integrations || {})) {
    addItem(items, 'changed', '외부 연동 설정 변경', '전송/전환 연동 설정이 달라졌습니다.');
  }

  if (!items.length) {
    addItem(items, 'same', '현재 페이지와 차이 없음', '복원해도 보이는 내용은 거의 같습니다.');
  }

  return items;
}
