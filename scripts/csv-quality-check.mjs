import { downloadLeadsCsv, filterLeadsForCsv, leadsToCsv } from '../src/lib/leadCsv.js';

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
    delivery: {
      status: 'failed',
      summary: 'webhook failed',
      logs: [
        { target: 'webhook', status: 'failed', message: 'timeout', at: '2026-05-21T03:01:00.000Z' },
        { target: 'email', status: 'success', message: 'sent', idempotencyKey: 'lead-formula:email', at: '2026-05-21T03:02:00.000Z' },
      ],
    },
    answers: [
      { label: '예약일', value: '2026-05-22' },
      { label: '예약시간', value: '10:30' },
      { label: '관심 항목', value: ['A', 'B'] },
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
assert(csv.startsWith('"') && csv.includes('"duplicate"') && csv.includes('"submittedAt"'), 'csv headers should be stable and readable');
assert(csv.includes('"\'=HYPERLINK(""https://bad.example"")"'), 'formula name should be neutralized and quoted');
assert(csv.includes('"\'-SUM(1,1)"'), 'formula message should be neutralized');
assert(csv.includes('"\'\t=cmd"'), 'tab-starting memo should be neutralized');
assert(csv.includes('A, B') && csv.includes('10:30'), 'answers should be flattened');
assert(csv.includes('입력:') && csv.includes('reservationDate'), 'dynamic form answer columns should be exported');
assert(csv.includes('"reservationDate: 2026-05-22 / reservationTime: 10:30 / note: line1\nline2"'), 'values should preserve long text safely inside a quoted cell');
assert(csv.includes('"실패"'), 'delivery status should be exported with the standardized operator label');
assert(csv.includes('"webhook: failed: timeout: 2026-05-21T03:01:00.000Z / email: success: sent: idempotency=lead-formula:email: 2026-05-21T03:02:00.000Z"'), 'delivery logs should include targets, status, message, idempotency key, and time');

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

downloadLeadsCsv(sampleLeads, { slug: '테스트 페이지' }, { filters: { deliveryStatus: 'success' } });
assert(capturedBlob?.parts?.[0]?.startsWith('\ufeff"'), 'download CSV should include UTF-8 BOM for Excel');
assert(capturedBlob?.parts?.[0]?.includes('"lead-success"') && !capturedBlob.parts[0].includes('"lead-formula"'), 'download CSV should honor filters');
assert(capturedBlob?.options?.type === 'text/csv;charset=utf-8', 'download blob should use CSV utf-8 content type');
assert(/^테스트-페이지-leads-\d{4}-\d{2}-\d{2}\.csv$/.test(capturedDownload), `download filename mismatch: ${capturedDownload}`);
assert(revokedUrl === 'blob:csv', 'download object URL should be revoked');

globalThis.Blob = originalBlob;
globalThis.URL = originalUrl;
globalThis.document = originalDocument;

console.log(JSON.stringify({ ok: true, checks: 21 }, null, 2));
