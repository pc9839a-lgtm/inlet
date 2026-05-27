import { buildPageRevisionDiff } from '../src/lib/pageRevisionDiff.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const current = {
  title: '현재 랜딩',
  slug: 'current-page',
  meta: { title: '현재 메타', gtm: 'GTM-OLD' },
  theme: { primary: '#111827' },
  integrations: { conversion: { enabled: false } },
  blocks: [
    { id: 'hero', type: 'hero', s: { title: '현재 첫 화면' } },
    { id: 'form', type: 'form', s: { title: '상담 신청' } },
    { id: 'footer', type: 'footer', s: { company: 'A' } },
  ],
};

const revision = {
  title: '복원 랜딩',
  slug: 'revision-page',
  meta: { title: '복원 메타', gtm: 'GTM-NEW', kakao: '1234' },
  theme: { primary: '#2563eb' },
  integrations: { conversion: { enabled: true, dataLayer: true } },
  blocks: [
    { id: 'hero', type: 'hero', s: { title: '복원 첫 화면' } },
    { id: 'reservation', type: 'reservation', s: { title: '방문 예약' } },
    { id: 'footer', type: 'footer', s: { company: 'B' } },
  ],
};

const diff = buildPageRevisionDiff(current, revision);
const labels = diff.map((item) => item.label);
const tones = new Set(diff.map((item) => item.tone));

assert(labels.includes('페이지명 변경'), 'title diff missing');
assert(labels.includes('페이지 주소 변경'), 'slug diff missing');
assert(labels.includes('추가된 블록'), 'added block diff missing');
assert(labels.includes('삭제된 블록'), 'removed block diff missing');
assert(labels.includes('수정된 블록'), 'changed block diff missing');
assert(labels.includes('검색/추적 설정 변경'), 'meta diff missing');
assert(labels.includes('디자인 테마 변경'), 'theme diff missing');
assert(labels.includes('외부 연동 설정 변경'), 'integration diff missing');
assert(tones.has('added') && tones.has('removed') && tones.has('changed'), 'diff tones missing');

const same = buildPageRevisionDiff(current, JSON.parse(JSON.stringify(current)));
assert(same.length === 1 && same[0].tone === 'same', 'same-page diff should have one neutral item');

console.log(JSON.stringify({ ok: true, checks: 10 }, null, 2));
