import { readFile } from 'node:fs/promises';
import { normalizeLeadItem } from '../src/lib/leadModel.js';
import {
  createLeadCaptureAction,
  leadCaptureServerErrorMessage,
} from '../src/runtime/leadCaptureActions.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stateStore(initialValue) {
  let value = initialValue;
  return {
    read: () => value,
    set: (next) => {
      value = typeof next === 'function' ? next(value) : next;
    },
  };
}

function apiError(status, code, message) {
  const error = new Error(`${code} ${message}`);
  error.status = status;
  error.details = { code, message };
  return error;
}

const targetPage = { id: 'page-1', projectId: 'project-1', slug: 'lead-test', title: '문의 테스트' };
const authUser = { ownerId: 'owner-1', projectId: 'project-1' };
const traffic = {
  channel: 'direct',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  sourceUrl: 'https://example.test/lead-test',
  referrer: '',
  sourceLabel: 'direct',
};

function buildAction({
  serverMode = false,
  persistLead,
  runLeadDeliveryForPage = async () => ({ status: 'success', summary: '1개 알림 전송 완료', logs: [] }),
} = {}) {
  const leads = stateStore([]);
  const meta = stateStore({ total: 0 });
  const toasts = [];
  const patches = [];
  const tracked = [];
  const persistedInputs = [];
  const visible = [];
  let nextId = 1;

  const action = createLeadCaptureAction({
    currentTrafficAttribution: () => traffic,
    uid: () => `lead-${nextId++}`,
    normalizeLeadItem,
    setLeads: leads.set,
    setLeadPageMeta: meta.set,
    trackForPage: (page, event) => tracked.push({ page, event }),
    isReservationLead: (lead) => lead.type === 'reservation',
    authForTargetPage: () => authUser,
    persistLead: async (lead, page, auth) => {
      persistedInputs.push({ lead, page, auth });
      if (persistLead) return persistLead(lead, page, auth);
      return lead;
    },
    runLeadDeliveryForPage,
    isServerLeadMode: () => serverMode,
    syncLeadPatch: (id, patch) => patches.push({ id, patch }),
    upsertVisibleLead: (lead) => visible.push(lead),
    showToast: (message, type) => toasts.push({ message, type }),
  });

  return { action, leads, meta, toasts, patches, tracked, persistedInputs, visible };
}

{
  const harness = buildAction({
    serverMode: false,
    runLeadDeliveryForPage: async () => {
      throw new Error('mock notification outage');
    },
  });
  await harness.action(targetPage, { type: 'form', name: '홍길동', phone: '01012345678' });

  const initial = harness.persistedInputs[0]?.lead;
  assert(initial?.status === '신규', `new lead must start in canonical 신규 status: ${initial?.status}`);
  assert(initial?.delivery?.status === 'pending', 'new lead delivery must start pending');
  assert(initial?.delivery?.summary === '알림 전송 대기', `new lead pending summary must be readable: ${initial?.delivery?.summary}`);
  assert(harness.tracked[0]?.event?.type === 'form_submit', 'form lead must preserve form_submit analytics');

  const finalLead = harness.leads.read()[0];
  assert(finalLead?.delivery?.status === 'failed', 'notification failure after persistence must remain a saved lead with failed delivery');
  assert(finalLead?.delivery?.summary === '접수는 저장됐지만 알림 전송에 실패했습니다.', 'notification failure must distinguish saved intake from failed notification');
  assert(finalLead?.delivery?.logs?.[0]?.target === '알림 전송', 'notification failure log target must be readable');
  assert(harness.patches[0]?.patch?.deliveryStatus === 'failed', 'local lead delivery failure must sync the failed delivery status');
}

for (const sample of [
  { status: 409, code: 'LEAD_DUPLICATE', message: '이미 접수된 연락처입니다.' },
  { status: 429, code: 'LEAD_RATE_LIMITED', message: '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.' },
]) {
  const harness = buildAction({
    serverMode: true,
    persistLead: async () => {
      throw apiError(sample.status, sample.code, sample.message);
    },
  });

  let rejected = false;
  try {
    await harness.action(targetPage, { type: 'reservation', name: '예약자', phone: '01022223333' });
  } catch {
    rejected = true;
  }

  assert(rejected, `${sample.status} server lead rejection must remain rejected`);
  assert(harness.toasts.length === 1, `${sample.status} rejection must surface exactly one toast`);
  assert(harness.toasts[0].message === sample.message, `${sample.status} toast must use the canonical server message without internal code`);
  assert(harness.toasts[0].type === 'error', `${sample.status} toast must remain an error`);
  assert(harness.leads.read().length === 0, `${sample.status} rejected optimistic lead must be removed`);
  assert(harness.meta.read().total === 0, `${sample.status} rejected optimistic total must be rolled back`);
}

{
  const error = apiError(503, 'LEAD_SAVE_FAILED', '서버가 일시적으로 응답하지 않습니다.');
  assert(
    leadCaptureServerErrorMessage(error) === '접수 저장에 실패했습니다. 서버가 일시적으로 응답하지 않습니다.',
    'ordinary server failure must clearly identify intake persistence failure',
  );
}

{
  const noDetailDuplicate = Object.assign(new Error('Request failed'), { status: 409 });
  const noDetailRate = Object.assign(new Error('Request failed'), { status: 429 });
  assert(leadCaptureServerErrorMessage(noDetailDuplicate) === '이미 접수된 연락처입니다.', '409 without structured details must use the canonical duplicate fallback');
  assert(leadCaptureServerErrorMessage(noDetailRate) === '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.', '429 without structured details must use the canonical rate-limit fallback');
}

const source = await readFile('src/runtime/leadCaptureActions.js', 'utf8');
assert(!source.includes("status: '??'"), 'broken placeholder lead status must not return');
assert(!source.includes("summary: '??"), 'broken placeholder delivery summaries must not return');
assert(source.includes("status: '신규'"), 'lead capture source must use canonical 신규 status explicitly');
assert(source.includes("summary: '알림 전송 대기'"), 'lead capture source must expose a readable pending delivery summary');
assert(source.includes("target: '알림 전송'"), 'lead notification failures must identify their target');
assert(source.includes("target: '접수 저장'"), 'lead persistence failures must identify their target');

console.log(JSON.stringify({
  ok: true,
  scope: 'lead-capture-status-and-feedback',
  canonicalNewStatus: true,
  pendingDeliveryReadable: true,
  savedLeadDeliveryFailureSeparated: true,
  duplicateFeedback: true,
  rateLimitFeedback: true,
  optimisticRollbackPreserved: true,
  analyticsPreserved: true,
}, null, 2));
