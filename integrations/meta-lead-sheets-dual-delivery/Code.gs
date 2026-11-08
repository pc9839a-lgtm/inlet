/** Meta Google Sheet -> Cloudflare relay only. No advertiser/CallTag processing here. */
const META_RELAY_ENDPOINT = 'https://pagero.kr/api/integrations/meta-sheets/relay';
const META_SOURCE_COLUMNS = 18; // A:R from the connected Meta instant form.
const META_CHUNK = 5;

function installMetaRelay() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('시트1');
  if (!sheet) throw new Error('메타 리드 시트 "시트1"을 찾지 못했습니다.');
  const props = PropertiesService.getScriptProperties();

  // Never forward historical rows (including Meta test leads) on first install.
  if (!props.getProperty('META_RELAY_CURSOR')) {
    props.setProperty('META_RELAY_CURSOR', String(Math.max(1, sheet.getLastRow())));
  }
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (['relayMetaLeads', 'processLeadBridge'].includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  ScriptApp.newTrigger('relayMetaLeads').timeBased().everyMinutes(1).create();
  console.log('Cloudflare 리드 전달 트리거 설치. 기존 행 제외. API 인증키 설정 전에는 전송되지 않음.');
}

function relayMetaLeads() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('META_SHEETS_RELAY_TOKEN');
  if (!token) throw new Error('스크립트 속성 META_SHEETS_RELAY_TOKEN을 먼저 입력하세요.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('시트1');
    if (!sheet) throw new Error('시트1을 찾지 못했습니다.');
    const headers = sheet.getRange(1, 1, 1, META_SOURCE_COLUMNS).getDisplayValues()[0];
    let cursor = Number(props.getProperty('META_RELAY_CURSOR'));
    if (!Number.isInteger(cursor) || cursor < 1) {
      throw new Error('installMetaRelay()를 먼저 실행하세요.');
    }
    const lastRow = sheet.getLastRow();
    let sentBatch = false;
    while (cursor < lastRow) {
      const count = Math.min(META_CHUNK, lastRow - cursor);
      const values = sheet.getRange(cursor + 1, 1, count, META_SOURCE_COLUMNS).getDisplayValues();
      const rows = values.map(row => Object.fromEntries(
        headers.map((key, index) => [String(key || ''), String(row[index] || '')])
      ));
      metaRelayPost_(token, rows);
      cursor += count;
      props.setProperty('META_RELAY_CURSOR', String(cursor));
      sentBatch = true;
    }
    // Cloudflare owns retries: an empty relay heartbeat lets it drain pending work.
    if (!sentBatch) metaRelayPost_(token, []);
  } finally {
    lock.releaseLock();
  }
}

function metaRelayPost_(token, rows) {
  const response = UrlFetchApp.fetch(META_RELAY_ENDPOINT, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { 'X-Meta-Relay-Token': token },
    payload: JSON.stringify({ rows }),
    muteHttpExceptions: true,
    followRedirects: false
  });
  const code = response.getResponseCode();
  let body = {};
  try { body = JSON.parse(response.getContentText()); } catch (_) {}
  if (code !== 202 || body.ok !== true || Number(body.accepted) !== rows.length) {
    throw new Error('Cloudflare 접수 확인 실패 (HTTP ' + code + '). 다음 실행에서 재전송합니다.');
  }
}
