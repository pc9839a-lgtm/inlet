import { downloadLeadsCsv, filterLeadsForCsv, leadsToCsv } from '../src/lib/leadCsv.js';
import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sampleLeads = [
  {
    id: 'lead-formula',
    type: '상담신청',
    status: '신규',
    createdAt: '2026-05-21T03:00:00.000Z',
    name: '=HYPERLINK("https://bad.example")',
    phone: '+01000000000',
    email: '@bad.example',
    message: '-SUM(1,1)',
    memo: '\t=cmd',
    page: {
      title: '테스트 페이지',
      url: 'https://pagero.kr/test-page',
    },
    source: {
      url: 'https://pagero.kr/test-page?utm_source=naver',
      utmSource: 'naver',
      utmMedium: 'cpc',
      utmCampaign: 'spring',
    },
    delivery: {
      status: 'failed',
      summary: 'webhook failed',
      logs: [
        { target: 'webhook', status: 'failed', message: 'timeout', at: '2026-05-21T03:01:00.000Z' },
        { target: 'email', status: 'success', message: 'sent', idempotencyKey: 'lead-formula:email', at: '2026-05-21T03:02:00.000Z' },
      ],
    },
    answers: [
      { id: 'name', label: '이름', value: '=HYPERLINK("https://bad.example")' },
      { id: 'phone', label: '연락처', value: '010-9999-9999' },
      { id: 'reservationDate', label: '예약일', value: '2026-05-22' },
      { id: 'reservationTime', label: '예약시간', value: '10:30' },
      { id: 'interest', label: '관심 항목', value: ['A', 'B'] },
    ],
    values: {
      reservationDate: '2026-05-22',
      reservationTime: '10:30',
      note: 'line1\nline2',
    },
  },
  {
    id: 'lead-success',
    type: '방문예약',
    status: '예약완료',
    createdAt: '2026-05-23T08:00:00.000Z',
    name: '정상 고객',
    phone: '010-1111-2222',
    delivery: { status: 'success', summary: 'sent', logs: [] },
  },
  {
    id: 'lead-old',
    type: '상담신청',
    status: '종료',
    createdAt: '2026-04-01T00:00:00.000Z',
    delivery: { status: 'none', summary: '', logs: [] },
  },
];

const csv = leadsToCsv([sampleLeads[0]]);

assert(csv.includes('\r\n'), 'csv should use CRLF row separators');
assert(csv.startsWith('"접수 ID"') && csv.includes('"페이지 URL"') && csv.includes('"UTM Source"'), 'csv headers should be readable and operational');
assert(csv.includes('"예약일"') && csv.includes('"예약시간"') && csv.includes('"관심 항목"') && csv.includes('"note"'), 'dynamic form answer columns should be exported as separate columns');
assert((csv.match(/"이름"/g) || []).length === 1 && (csv.match(/"연락처"/g) || []).length === 1, 'base customer fields should not be duplicated as dynamic form columns');
assert(csv.includes('"\'=HYPERLINK(""https://bad.example"")"'), 'formula name should be neutralized and quoted');
assert(csv.includes('"\'-SUM(1,1)"'), 'formula message should be neutralized');
assert(csv.includes('"\'\t=cmd"'), 'tab-starting memo should be neutralized');
assert(csv.includes('"A, B"') && csv.includes('"10:30"') && csv.includes('"line1\nline2"'), 'form values should be flattened into their own cells');
assert(csv.includes('"https://pagero.kr/test-page"') && csv.includes('"naver"') && csv.includes('"spring"'), 'page and source data should be exported');
assert(!csv.includes('webhook failed') && !csv.includes('idempotency=') && !csv.includes('timeout'), 'delivery status and logs should not be exported in operator CSV');

const serverSource = await readFile('server/index.mjs', 'utf8');
const functionsCsvSource = await readFile('functions/api/leads/export.csv.js', 'utf8');
assert(!serverSource.includes('외부 전송 상태') && !serverSource.includes('외부 전송 로그'), 'server CSV exports should not expose delivery status/log columns');
assert(!functionsCsvSource.includes('답변 전체') && !functionsCsvSource.includes('입력값 전체') && !functionsCsvSource.includes('answersText(lead.answers)') && !functionsCsvSource.includes('valuesText(lead.values)'), 'functions CSV exports should expose form fields as columns instead of bundled answer/value text');
assert(!serverSource.includes('leadsToCsvV2') && !serverSource.includes('function leadsToCsvExport('), 'legacy server CSV exporters should be removed');

const filtered = filterLeadsForCsv(sampleLeads, {
  dateFrom: '2026-05-20',
  dateTo: '2026-05-22',
  status: '신규',
  kind: 'consult',
  deliveryStatus: 'needs-attention',
});
assert(filtered.length === 1 && filtered[0].id === 'lead-formula', 'csv filters should combine date/status/kind/delivery constraints');
assert(filterLeadsForCsv(sampleLeads, { dateFrom: '2026-05-23', dateTo: '2026-05-23' }).map((lead) => lead.id).join(',') === 'lead-success', 'date-only CSV filter mismatch');
assert(filterLeadsForCsv(sampleLeads, { status: '종료' }).map((lead) => lead.id).join(',') === 'lead-old', 'status-only CSV filter mismatch');
assert(filterLeadsForCsv(sampleLeads, { kind: 'reservation' }).map((lead) => lead.id).join(',') === 'lead-success', 'kind-only CSV filter mismatch');
assert(filterLeadsForCsv(sampleLeads, { deliveryStatus: 'none' }).map((lead) => lead.id).join(',') === 'lead-old', 'delivery-only CSV filter mismatch');

const filteredCsv = leadsToCsv(sampleLeads, { filters: { deliveryStatus: 'success', kind: 'reservation' } });
assert(filteredCsv.includes('"lead-success"') && !filteredCsv.includes('"lead-formula"'), 'leadsToCsv should apply export filters');

let capturedBlob = null;
let capturedDownload = '';
let revokedUrl = '';
const originalBlob = globalThis.Blob;
const originalUrl = globalThis.URL;
const originalDocument = globalThis.document;

globalThis.Blob = class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    capturedBlob = this;
  }
};
globalThis.URL = {
  createObjectURL(blob) {
    assert(blob === capturedBlob, 'download should create an object URL for the CSV blob');
    return 'blob:csv';
  },
  revokeObjectURL(url) {
    revokedUrl = url;
  },
};
globalThis.document = {
  body: {
    appendChild(node) {
      node.appended = true;
    },
  },
  createElement(tag) {
    assert(tag === 'a', 'download should create an anchor');
    return {
      href: '',
      download: '',
      click() {
        capturedDownload = this.download;
      },
      remove() {
        this.removed = true;
      },
    };
  },
};

downloadLeadsCsv(sampleLeads, { slug: '테스트 페이지' }, { filters: { deliveryStatus: 'success', month: '2026-05' } });
assert(capturedBlob?.parts?.[0]?.startsWith('\ufeff"'), 'download CSV should include UTF-8 BOM for Excel');
assert(capturedBlob?.parts?.[0]?.includes('"lead-success"') && !capturedBlob.parts[0].includes('"lead-formula"'), 'download CSV should honor filters');
assert(capturedBlob?.options?.type === 'text/csv;charset=utf-8', 'download blob should use CSV utf-8 content type');
assert(capturedDownload === '테스트-페이지-leads-2026-05.csv', `download filename should use selected month: ${capturedDownload}`);
assert(revokedUrl === 'blob:csv', 'download object URL should be revoked');

globalThis.Blob = originalBlob;
globalThis.URL = originalUrl;
globalThis.document = originalDocument;

console.log(JSON.stringify({ ok: true, checks: 20 }, null, 2));
