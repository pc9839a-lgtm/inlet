import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sanitizeAnalyticsEvent } from '../src/lib/analyticsEventPrivacy.js';
import { encodeD1Event, decodeD1Event } from '../server/storage/d1Adapter.mjs';

const input = {
  id: 'event-123', type: 'page_view', label: 'email@example.com',
  visitorId: 'visitor-1', sessionId: 'session-1', dedupeKey: 'event-key-1',
  device: 'mobile', sourceUrl: 'https://example.com/landing?utm_source=naver&utm_medium=cpc&utm_campaign=summer&email=private%40example.com',
  phone: '010-1234-5678', email: 'private@example.com', memo: 'sensitive customer message',
  answers: [{ phone: '010-1234-5678' }], project: { secret: 'private' },
  createdAt: '2026-05-10T02:00:00.000Z',
};
const safe = sanitizeAnalyticsEvent(input);
assert.equal(safe.type, 'page_view');
assert.equal(safe.channel, 'naver');
assert.equal(safe.utmSource, 'naver');
assert.equal(safe.utmMedium, 'cpc');
assert.equal(safe.utmCampaign, 'summer');
assert.equal(safe.visitorId, 'visitor-1');
assert.equal(safe.sessionId, 'session-1');
assert.equal(safe.dedupeKey, 'event-key-1');
assert(!('sourceUrl' in safe) && !('phone' in safe) && !('email' in safe) && !('answers' in safe) && !('project' in safe));
assert(!('label' in safe), 'arbitrary text labels must be dropped');
assert(!JSON.stringify(safe).includes('private@example.com'));
const d1 = encodeD1Event(input, { projectId: 'project-1', pageSlug: 'landing' });
assert(d1.channel === 'naver' && d1.event_type === 'page_view');
assert(!d1.payload_json.includes('private@example.com') && !d1.payload_json.includes('010-1234-5678') && !d1.payload_json.includes('sourceUrl'));
assert(decodeD1Event(d1).visitorId === 'visitor-1', 'pseudonymous visitor identity needed for existing analytics must roundtrip');
const testMarker = sanitizeAnalyticsEvent({ type: 'page_view', sourceUrl: 'https://example.com/?pagero_test=1&utm_source=pagero_test', isTest: true });
assert(testMarker.channel === 'pagero_test' && testMarker.isTest === true);
assert(!('sourceUrl' in testMarker));
const blockedIds = sanitizeAnalyticsEvent({ type: 'cta_click', visitorId: 'private@example.com', dedupeKey: '01012345678', device: 'invalid', label: 'call' });
assert(!('visitorId' in blockedIds) && !('dedupeKey' in blockedIds) && blockedIds.device === 'unknown' && blockedIds.label === 'call');
const currentServer = await readFile('server/index.mjs', 'utf8');
const currentD1 = await readFile('server/storage/d1Adapter.mjs', 'utf8');
assert(currentServer.includes('sanitizeAnalyticsEvent(event)'), 'JSONL/server path must sanitize client events');
assert(currentD1.includes('sanitizeAnalyticsEvent(inputEvent)'), 'D1 encoder must sanitize before payload JSON');
console.log(JSON.stringify({ ok: true, name: 'analytics-event-pii-minimization', payloadAllowlist: true, attributionPreserved: true }));
