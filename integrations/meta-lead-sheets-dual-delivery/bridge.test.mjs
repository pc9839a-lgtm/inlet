import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Code.gs'), 'utf8');

function fakeApp(data) {
  const rows = data.map(row => row.slice());
  const vars = new Map();
  const calls = [];
  const hooks = [];
  let calltagReply = { code: 202, body: '{"ok":true,"status":"MAPPED","eventId":"evt_1"}' };
  let advertiserReply = { code: 200, body: 'OK' };

  const sheet = {
    rows,
    getLastColumn: () => rows[0]?.length || 0,
    getLastRow: () => rows.length,
    getRange(r, c, height = 1, width = 1) {
      const ensureRow = index => { while (rows.length <= index) rows.push([]); };
      return {
        getValues: () => Array.from({ length: height }, (_, i) =>
          Array.from({ length: width }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
        setValues(values) {
          values.forEach((line, i) => {
            ensureRow(r - 1 + i);
            line.forEach((value, j) => { rows[r - 1 + i][c - 1 + j] = value; });
          });
        },
        getValue: () => rows[r - 1]?.[c - 1] ?? '',
        setValue(value) {
          ensureRow(r - 1);
          rows[r - 1][c - 1] = value;
        }
      };
    }
  };
  const properties = {
    getProperty: key => vars.get(key) || '',
    setProperty: (key, value) => { vars.set(key, String(value)); }
  };
  const app = {
    PropertiesService: { getScriptProperties: () => properties },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [sheet], getSheetByName: () => sheet }),
      openById: () => ({ getSheets: () => [sheet], getSheetByName: () => sheet }), flush() {} },
    ScriptApp: {
      getProjectTriggers: () => hooks,
      deleteTrigger: tr => { const i = hooks.indexOf(tr); if (i >= 0) hooks.splice(i, 1); },
      newTrigger: name => ({ timeBased: () => ({ everyMinutes: n => ({ create: () =>
        hooks.push({ getHandlerFunction: () => name, minutes: n }) }) }) })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { getUuid: () => 'sample-uuid', formatDate: () => '2026-11-06T12:00:00+09:00' },
    UrlFetchApp: {
      fetch(url, options) {
        calls.push({ url, options });
        const info = url.includes('/api/calltag/v1/hooks/') ? calltagReply : advertiserReply;
        return { getResponseCode: () => info.code, getContentText: () => info.body };
      }
    },
    console: { log() {} }
  };
  const context = createContext(app);
  new Script(source, { filename: 'Code.gs' }).runInContext(context);
  const run = func => context[func]();
  const status = (r, colName) => rows[r - 1][rows[0].indexOf(colName)];
  const setDefaults = () => {
    vars.set('CALLTAG_WEBHOOK_URL', 'https://pagero.kr/api/calltag/v1/hooks/ctwh_sampletoken1234567890123456');
    vars.set('ADVERTISER_URL', 'https://ollymkt.shop/dbapi/');
  };
  return { rows, vars, calls, hooks, context, run, status, setDefaults,
    replyCallTag(code, body) { calltagReply = { code, body }; },
    replyAdvertiser(code, body) { advertiserReply = { code, body }; } };
}

test('Code.gs parses as JavaScript', () => {
  assert.doesNotThrow(() => new Script(source, { filename: 'Code.gs' }));
});

test('installation skips existing rows and does not send before enable', () => {
  const x = fakeApp([['lead_id', '성함', '연락처'], ['old-01', '과거', '01012345678']]);
  x.run('installLeadBridge');
  assert.equal(x.status(2, 'CT_상태'), 'SKIPPED_OLD');
  assert.equal(x.status(2, '광고주_상태'), 'SKIPPED_OLD');
  assert.equal(x.hooks[0].minutes, 1);
  x.run('processLeadBridge');
  assert.equal(x.calls.length, 0);
});

test('new row delivers independently to both targets with stable field mappings', () => {
  const x = fakeApp([['lead_id', '성함', '연락처', '채무금액', '문의내용'],
    ['old-01', '과거', '01012345678', '', '']]);
  x.setDefaults();
  x.run('installLeadBridge');
  x.rows.push(['meta-002', '테스트', '010-2222-3333', '1천만원', '상담 희망']);
  x.run('enableLeadBridge');
  x.run('processLeadBridge');
  assert.equal(x.calls.length, 2);
  assert.equal(x.status(3, 'CT_상태'), 'SENT');
  assert.equal(x.status(3, '광고주_상태'), 'SENT');
  const body = JSON.parse(x.calls[0].options.payload);
  assert.equal(body.phone, '01022223333');
  assert.equal(body.event_id, 'meta-meta-002');
  assert.match(body.content, /상담 희망/);
  assert.match(body.content, /money: 1천만원/);
  assert.match(x.calls[1].options.payload, /ITEM=64/);
  assert.match(x.calls[1].options.payload, /DATAS_phone=010-2222-3333/);
  assert.match(x.calls[1].options.payload, /DATAS_money=/);
  x.run('processLeadBridge');
  assert.equal(x.calls.length, 2, 'successful leads must not be sent again');
});

test('unknown advertiser HTTP 200 remains REVIEW and never auto-retries', () => {
  const x = fakeApp([['lead_id', '성함', '연락처']]);
  x.setDefaults(); x.run('installLeadBridge'); x.rows.push(['id-1', '샘플', '01012341234']);
  x.replyAdvertiser(200, '<html>ok?</html>');
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  assert.equal(x.status(2, 'CT_상태'), 'SENT');
  assert.equal(x.status(2, '광고주_상태'), 'REVIEW');
  x.run('processLeadBridge');
  assert.equal(x.calls.length, 2);
});

test('CallTag MAPPING_REQUIRED is not a success despite HTTP 202', () => {
  const x = fakeApp([['lead_id', '성함', '연락처']]);
  x.setDefaults(); x.run('installLeadBridge'); x.rows.push(['id-2', '샘플', '01099990000']);
  x.replyCallTag(202, '{"ok":true,"status":"MAPPING_REQUIRED"}');
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  assert.equal(x.status(2, 'CT_상태'), 'ERROR');
  assert.equal(x.status(2, '광고주_상태'), 'SENT');
});

test('CallTag transient errors retry at most three times without advertiser duplication', () => {
  const x = fakeApp([['lead_id', '성함', '연락처']]);
  x.setDefaults(); x.run('installLeadBridge'); x.rows.push(['id-3', '샘플', '01099991111']);
  x.replyCallTag(503, '{"ok":false}');
  x.run('enableLeadBridge');
  x.run('processLeadBridge');
  assert.equal(x.status(2, 'CT_상태'), 'RETRY');
  x.run('processLeadBridge');
  x.run('processLeadBridge');
  assert.equal(x.status(2, 'CT_상태'), 'ERROR');
  assert.equal(x.calls.filter(c => c.url.includes('dbapi')).length, 1);
});

test('same Meta lead ID on two rows is deduped by destination', () => {
  const x = fakeApp([['lead_id', '성함', '연락처']]);
  x.setDefaults(); x.run('installLeadBridge');
  x.rows.push(['id-7', '샘플', '01012341234']);
  x.rows.push(['id-7', '샘플', '01012341234']);
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  assert.equal(x.calls.length, 2);
  assert.equal(x.status(2, 'CT_상태'), 'SENT');
  assert.equal(x.status(3, 'CT_상태'), 'SENT');
  assert.equal(x.status(3, '광고주_상태'), 'SENT');
});

test('HTTP advertiser endpoint is never eligible for enable', () => {
  const x = fakeApp([['lead_id', '성함', '연락처']]);
  x.setDefaults();
  x.vars.set('ADVERTISER_URL', 'http://ollymkt.shop/dbapi/');
  x.run('installLeadBridge');
  assert.throws(() => x.run('enableLeadBridge'), /HTTPS/);
  assert.equal(x.calls.length, 0);
});

test('manual advertiser retry requires review and rejects SENT rows', () => {
  const x = fakeApp([['lead_id', '성함', '연락처']]);
  x.setDefaults(); x.run('installLeadBridge'); x.rows.push(['id-5', '샘플', '01012341234']);
  x.replyAdvertiser(200, 'unknown');
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  x.context.retryLeadBridgeRow(2, 'AD');
  assert.equal(x.status(2, '광고주_상태'), 'PENDING');
  assert.throws(() => x.context.retryLeadBridgeRow(2, 'CT'), /이미 전송 성공/);
});


test('Make blueprint Korean field names and P:+82 phone are compatible', () => {
  const x = fakeApp([['lead_id', '이름', 'phone_number',
    '총_채무액_선택_(2,000미만_불가)', '거주지역을_입력해주세요', '상담가능시간',
    '문의내용_(ex.개인회생/파산_등)']]);
  x.setDefaults(); x.run('installLeadBridge');
  x.rows.push(['make-01', '테스트', 'P:+821012345678',
    '2,000~3,000', '경기', '오후', '개인회생 상담']);
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  assert.equal(x.status(2, 'CT_상태'), 'SENT');
  assert.equal(x.status(2, '광고주_상태'), 'SENT');
  const payload = x.calls[1].options.payload;
  assert.match(payload, /ITEM=64/);
  assert.match(payload, /DATAS_phone=010-1234-5678/);
  assert.match(payload, /DATAS_money=2%2C000~3%2C000/);
  assert.match(payload, /DATAS_area=%EA%B2%BD%EA%B8%B0/);
  assert.match(payload, /DATAS_calldate=/);
  assert.match(payload, /DATAS_data=/);
  assert.equal(JSON.parse(x.calls[0].options.payload).phone, '01012345678');
});


test('actual Meta-created sheet headers deliver into correct advertiser fields', () => {
  const headers = ['id','created_time','ad_id','ad_name','adset_id','adset_name',
    'campaign_id','campaign_name','form_id','form_name','is_organic','platform',
    '총_채무액(2,000만원_이상_가능)','상담가능시간',
    '문의내용(ex개인회생/파산_등)','full_name','phone_number','lead_status'];
  const x = fakeApp([headers]);
  x.setDefaults(); x.run('installLeadBridge');
  x.rows.push(['l:99011', '2026-11-08T07:23:31-05:00','','','','','','','','개인회생',
    'false','facebook','3000만원 이상','오후 3시','상담 요청','테스트 사용자','010-2345-6789','CREATED']);
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  assert.equal(x.calls.length, 2);
  const advertiser = x.calls[1].options.payload;
  assert.match(advertiser, /ITEM=64/);
  assert.match(advertiser, /DATAS_phone=010-2345-6789/);
  assert.match(advertiser, /DATAS_money=/);
  assert.match(decodeURIComponent(advertiser), /3000만원 이상/);
  assert.match(decodeURIComponent(advertiser), /상담 요청/);
  assert.equal(x.status(2, 'CT_상태'), 'SENT');
  assert.equal(x.status(2, '광고주_상태'), 'SENT');
});

test('Meta generated dummy lead cannot be forwarded even with valid-looking columns', () => {
  const x = fakeApp([['id','full_name','phone_number','총_채무액(2,000만원_이상_가능)']]);
  x.setDefaults(); x.run('installLeadBridge');
  x.rows.push(['l:101','<test lead: dummy data for full_name>',
    'p:<test lead: dummy data for phone_number>', '<test lead: dummy data for debt>']);
  x.run('enableLeadBridge'); x.run('processLeadBridge');
  assert.equal(x.calls.length, 0);
  assert.equal(x.status(2, 'CT_상태'), 'SKIPPED_TEST');
  assert.equal(x.status(2, '광고주_상태'), 'SKIPPED_TEST');
});
