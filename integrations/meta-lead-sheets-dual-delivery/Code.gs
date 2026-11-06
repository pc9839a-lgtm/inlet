/**
 * Meta Lead Ads -> Google Sheets -> CallTag Webhook + advertiser DB API
 *
 * Standalone/container-bound Google Apps Script (V8).
 * Do not store customer data, credentials or webhook tokens in this source file.
 * Does not use onEdit: API/integration-added rows do not trigger onEdit reliably.
 *
 * First run installLeadBridge(), set Script Properties, map the CallTag webhook,
 * then run enableLeadBridge(). Existing rows are NOT sent by default.
 */
const LEAD_BRIDGE = Object.freeze({
  STATE: {
    CT: 'CT_상태',
    CT_ATTEMPTS: 'CT_시도',
    CT_AT: 'CT_최종시도',
    CT_INFO: 'CT_결과',
    AD: '광고주_상태',
    AD_ATTEMPTS: '광고주_시도',
    AD_AT: '광고주_최종시도',
    AD_INFO: '광고주_결과',
    EVENT: 'CT_EVENT_ID'
  },
  ALIASES: {
    event_id: ['lead_id', 'lead id', 'meta_lead_id', 'id', '리드id', '리드번호', '접수번호'],
    name: ['name', 'full_name', 'fullname', '성함', '이름', '고객명', '신청자명', 'DATAS_name'],
    phone: ['phone', 'phone_number', 'mobile', 'tel', '전화번호', '연락처', '휴대폰번호', 'DATAS_phone'],
    email: ['email', '이메일', 'DATAS_email'],
    job: ['job', '직업', 'DATAS_job'],
    area: ['area', 'region', '거주지역', '지역', 'DATAS_area'],
    money: ['money', 'debt', '채무금액', '채무', 'DATAS_money'],
    calldate: ['calldate', '상담가능시간', '상담시간', 'DATAS_calldate'],
    age: ['age', '나이', 'DATAS_age'],
    data: ['data', 'content', 'message', '문의내용', '상담내용', 'DATAS_data'],
    gtype: ['gtype', '업종', 'DATAS_gtype'],
    insert_ad: ['insert_ad', '유입경로', '광고출처', 'DATAS_insert_ad'],
    partner_id: ['partner_id', '접수인아이디', '접수인id', 'DATAS_partner_id'],
    zonetype: ['zonetype', '공간유형', 'DATAS_zonetype'],
    buildingtype: ['buildingtype', '건물유형', 'DATAS_buildingtype'],
    sitype: ['sitype', '시공유형', 'DATAS_sitype'],
    zonesize: ['zonesize', '평수', 'DATAS_zonesize'],
    yemoney: ['yemoney', '예산', 'DATAS_yemoney'],
    schedule: ['schedule', '일정', 'DATAS_schedule'],
    isaddr: ['isaddr', '주소', 'DATAS_isaddr'],
    addr_det: ['addr_det', '나머지주소', '상세주소', 'DATAS_addr_det'],
    income: ['income', '소득', 'DATAS_income'],
    submitted_at: ['created_time', 'created_at', 'submitted_at', '접수일시', '신청일시']
  },
  AD_FIELDS: {
    name: 'DATAS_name', phone: 'DATAS_phone', job: 'DATAS_job',
    area: 'DATAS_area', money: 'DATAS_money', calldate: 'DATAS_calldate',
    age: 'DATAS_age', email: 'DATAS_email', data: 'DATAS_data',
    gtype: 'DATAS_gtype', insert_ad: 'DATAS_insert_ad',
    partner_id: 'DATAS_partner_id', zonetype: 'DATAS_zonetype',
    buildingtype: 'DATAS_buildingtype', sitype: 'DATAS_sitype',
    zonesize: 'DATAS_zonesize', yemoney: 'DATAS_yemoney',
    schedule: 'DATAS_schedule', isaddr: 'DATAS_isaddr',
    addr_det: 'DATAS_addr_det', income: 'DATAS_income'
  },
  MAX_ROWS_PER_RUN: 15,
  MAX_CALLTAG_ATTEMPTS: 3
});

function installLeadBridge() {
  const p = PropertiesService.getScriptProperties();
  const sheet = leadBridgeSheet_();
  const originalLastCol = sheet.getLastColumn();
  leadBridgeEnsureState_(sheet);

  // One-time bootstrap. Never forward historical customer data without review.
  if (p.getProperty('LEAD_BRIDGE_INITIALIZED') !== '1') {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const rows = sheet.getRange(2, 1, lastRow - 1, originalLastCol).getValues();
      const cols = leadBridgeColumnIndexes_(sheet);
      rows.forEach((row, i) => {
        if (!row.some(value => leadBridgeText_(value) !== '')) return;
        leadBridgeMark_(sheet, i + 2, cols, 'CT', 'SKIPPED_OLD', 0, '설치 이전 데이터');
        leadBridgeMark_(sheet, i + 2, cols, 'AD', 'SKIPPED_OLD', 0, '설치 이전 데이터');
      });
    }
    p.setProperty('LEAD_BRIDGE_INITIALIZED', '1');
  }

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processLeadBridge')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processLeadBridge').timeBased().everyMinutes(1).create();
  p.setProperty('LEAD_BRIDGE_ENABLED', '0');
  console.log('연동 설치 완료. 기존 데이터는 전송 제외, 실제 전송 비활성화.');
}

function enableLeadBridge() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('LEAD_BRIDGE_INITIALIZED') !== '1') {
    throw new Error('installLeadBridge()부터 실행하세요.');
  }
  leadBridgeEndpoints_();
  const sheet = leadBridgeSheet_();
  const rows = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fields = leadBridgeFieldIndexes_(rows);
  if (fields.phone === undefined) throw new Error('연락처 열을 찾지 못했습니다. FIELD_MAP_JSON을 확인하세요.');
  p.setProperty('LEAD_BRIDGE_ENABLED', '1');
  console.log('신규 행 연동 활성화. 콜태그 Webhook 필드 매핑 완료 여부를 별도 확인하세요.');
}

function disableLeadBridge() {
  PropertiesService.getScriptProperties().setProperty('LEAD_BRIDGE_ENABLED', '0');
}

// Call this manually after inspecting the previous delivery. Never automatically
// replay advertiser requests with uncertain responses (potential duplicate billing).
function retryLeadBridgeRow(rowNumber, destination) {
  const sheet = leadBridgeSheet_();
  const cols = leadBridgeColumnIndexes_(sheet);
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('올바른 데이터 행 번호를 지정하세요.');
  }
  const key = String(destination || '').toUpperCase();
  if (!['CT', 'AD'].includes(key)) throw new Error('destination은 CT 또는 AD만 가능합니다.');
  const prefix = key === 'CT' ? 'CT' : 'AD';
  const current = String(sheet.getRange(rowNumber, cols[LEAD_BRIDGE.STATE[prefix]]).getValue() || '');
  if (current === 'SENT') throw new Error('이미 전송 성공인 행입니다. 중복 전송을 금지합니다.');
  leadBridgeMark_(sheet, rowNumber, cols, prefix, 'PENDING', 0, '담당자 수동 재시도');
}

function processLeadBridge() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('LEAD_BRIDGE_ENABLED') !== '1') return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const endpoints = leadBridgeEndpoints_();
    const sheet = leadBridgeSheet_();
    const cols = leadBridgeEnsureState_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const all = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const fields = leadBridgeFieldIndexes_(all[0]);
    if (fields.phone === undefined) throw new Error('연락처 열이 없습니다.');
    const delivered = { CT: new Set(), AD: new Set() };

    // Deduplicate even if Meta or an upstream sheet connector appends the same lead twice.
    for (let i = 1; i < all.length; i++) {
      const id = leadBridgeText_(all[i][cols[LEAD_BRIDGE.STATE.EVENT] - 1]) ||
        leadBridgeEventFromSource_(all[i], fields);
      if (!id) continue;
      if (all[i][cols[LEAD_BRIDGE.STATE.CT] - 1] === 'SENT') delivered.CT.add(id);
      if (all[i][cols[LEAD_BRIDGE.STATE.AD] - 1] === 'SENT') delivered.AD.add(id);
    }

    let processed = 0;
    for (let i = 1; i < all.length && processed < LEAD_BRIDGE.MAX_ROWS_PER_RUN; i++) {
      const row = all[i];
      const rowNumber = i + 1;
      const ctStatus = leadBridgeText_(row[cols[LEAD_BRIDGE.STATE.CT] - 1]);
      const adStatus = leadBridgeText_(row[cols[LEAD_BRIDGE.STATE.AD] - 1]);
      if (!leadBridgeEligible_(ctStatus) && !leadBridgeEligible_(adStatus)) continue;
      if (row.every(v => leadBridgeText_(v) === '')) continue;

      let eventId = leadBridgeText_(row[cols[LEAD_BRIDGE.STATE.EVENT] - 1]);
      if (!eventId) {
        eventId = leadBridgeEventFromSource_(row, fields) || ('sheet-' + Utilities.getUuid());
        sheet.getRange(rowNumber, cols[LEAD_BRIDGE.STATE.EVENT]).setValue(eventId);
      }
      const source = leadBridgeSource_(row, fields);
      const phone = leadBridgeNormalizePhone_(source.phone);
      if (phone.length < 9 || phone.length > 12) {
        if (leadBridgeEligible_(ctStatus)) leadBridgeMark_(sheet, rowNumber, cols, 'CT', 'ERROR', 0, '연락처 형식 확인');
        if (leadBridgeEligible_(adStatus)) leadBridgeMark_(sheet, rowNumber, cols, 'AD', 'ERROR', 0, '연락처 형식 확인');
        processed++;
        continue;
      }
      source.phone = phone;

      // Two separate status machines: one destination never blocks the other.
      if (leadBridgeEligible_(ctStatus)) {
        if (delivered.CT.has(eventId)) {
          leadBridgeMark_(sheet, rowNumber, cols, 'CT', 'SENT', 0, '중복 리드 전송 생략');
        } else {
          const attempts = Number(row[cols[LEAD_BRIDGE.STATE.CT_ATTEMPTS] - 1] || 0) + 1;
          leadBridgeMark_(sheet, rowNumber, cols, 'CT', 'SENDING', attempts, '전송 중');
          SpreadsheetApp.flush();
          let result;
          try { result = leadBridgeSendCallTag_(endpoints.calltag, source, eventId); }
          catch (_) { result = { status: 'RETRY', info: '네트워크 오류' }; }
          if (result.status === 'RETRY' && attempts >= LEAD_BRIDGE.MAX_CALLTAG_ATTEMPTS) {
            result = { status: 'ERROR', info: '재시도 횟수 초과' };
          }
          leadBridgeMark_(sheet, rowNumber, cols, 'CT', result.status, attempts, result.info);
          if (result.status === 'SENT') delivered.CT.add(eventId);
        }
      }

      if (leadBridgeEligible_(adStatus)) {
        if (delivered.AD.has(eventId)) {
          leadBridgeMark_(sheet, rowNumber, cols, 'AD', 'SENT', 0, '중복 리드 전송 생략');
        } else {
          const attempts = Number(row[cols[LEAD_BRIDGE.STATE.AD_ATTEMPTS] - 1] || 0) + 1;
          // SENDING remains on crash: explicitly review ambiguous advertiser deliveries.
          leadBridgeMark_(sheet, rowNumber, cols, 'AD', 'SENDING', attempts, '전송 확인 중');
          SpreadsheetApp.flush();
          let result;
          try { result = leadBridgeSendAdvertiser_(endpoints.advertiser, endpoints.item, source); }
          catch (_) { result = { status: 'REVIEW', info: '응답 불명확: 중복 전송 전 확인' }; }
          leadBridgeMark_(sheet, rowNumber, cols, 'AD', result.status, attempts, result.info);
          if (result.status === 'SENT') delivered.AD.add(eventId);
        }
      }
      processed++;
    }
    console.log('검토한 신규 행 수: ' + processed); // No PII in logs.
  } finally {
    lock.releaseLock();
  }
}

function leadBridgeSendCallTag_(endpoint, source, eventId) {
  const details = [];
  Object.keys(LEAD_BRIDGE.AD_FIELDS).forEach(key => {
    if (['name', 'phone', 'email', 'data'].includes(key)) return;
    if (source[key]) details.push(key + ': ' + source[key]);
  });
  const payload = {
    name: source.name || '',
    phone: source.phone,
    email: source.email || '',
    content: [source.data, details.join('\n')].filter(Boolean).join('\n').slice(0, 4900),
    event_id: eventId,
    submitted_at: source.submitted_at || new Date().toISOString()
  };
  // Duplicate retries use the same external_id and Idempotency-Key.
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(payload),
    headers: { 'Idempotency-Key': 'sheet-' + eventId },
    muteHttpExceptions: true,
    followRedirects: false
  });
  const code = response.getResponseCode();
  let data;
  try { data = JSON.parse(response.getContentText()); } catch (_) {
    data = {};
  }
  if (code >= 200 && code < 300 && data.status === 'MAPPED' && data.eventId) {
    return { status: 'SENT', info: '수신 성공 ' + code };
  }
  if (code === 429 || code >= 500) return { status: 'RETRY', info: '콜태그 일시 오류 ' + code };
  if (data.status === 'MAPPING_REQUIRED') {
    return { status: 'ERROR', info: '콜태그 Webhook 필드 매핑 필요' };
  }
  if (data.status === 'REJECTED') {
    return { status: 'ERROR', info: '콜태그 데이터 매핑 거부' };
  }
  return { status: 'ERROR', info: '콜태그 응답 확인 필요 HTTP ' + code };
}

function leadBridgeSendAdvertiser_(endpoint, item, source) {
  const form = { ITEM: item };
  Object.keys(LEAD_BRIDGE.AD_FIELDS).forEach(key => {
    if (source[key]) form[LEAD_BRIDGE.AD_FIELDS[key]] = source[key];
  });
  const body = Object.keys(form).map(k =>
    encodeURIComponent(k) + '=' + encodeURIComponent(String(form[k]))).join('&');
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded; charset=utf-8',
    payload: body,
    muteHttpExceptions: true,
    followRedirects: false
  });
  const code = response.getResponseCode();
  // The external API has no documented response contract. Never infer success
  // from HTTP 200 alone, and never auto-retry uncertain paid lead deliveries.
  const text = String(response.getContentText() || '').trim();
  let json = {};
  try { json = JSON.parse(text); } catch (_) {}
  const acknowledged = json.ok === true || json.success === true ||
    /^ok$|^success$|^1$/i.test(text) ||
    /^(ok|success|accepted)$/i.test(String(json.status || json.result || ''));
  if (code >= 200 && code < 300 && acknowledged) return { status: 'SENT', info: '수신 성공 ' + code };
  if (code >= 200 && code < 300) return { status: 'REVIEW', info: 'HTTP ' + code + ': 광고주 응답 형식 확인' };
  return { status: 'REVIEW', info: 'HTTP ' + code + ': 광고주 수신 여부 확인' };
}

function leadBridgeSource_(row, fields) {
  const out = {};
  Object.keys(LEAD_BRIDGE.ALIASES).forEach(key => {
    out[key] = fields[key] === undefined ? '' : leadBridgeText_(row[fields[key]]);
  });
  if (!out.insert_ad) out.insert_ad = 'Meta Lead Ads';
  return out;
}

function leadBridgeEventFromSource_(row, fields) {
  const raw = fields.event_id === undefined ? '' : leadBridgeText_(row[fields.event_id]);
  return raw ? ('meta-' + raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 160)) : '';
}

function leadBridgeFieldIndexes_(headers) {
  const props = PropertiesService.getScriptProperties();
  let overrides = {};
  try { overrides = JSON.parse(props.getProperty('FIELD_MAP_JSON') || '{}'); }
  catch (_) { throw new Error('FIELD_MAP_JSON은 올바른 JSON이어야 합니다.'); }
  const indexed = {};
  headers.forEach((header, i) => {
    const normalized = leadBridgeHeader_(header);
    if (normalized && indexed[normalized] === undefined) indexed[normalized] = i;
  });
  const result = {};
  Object.keys(LEAD_BRIDGE.ALIASES).forEach(key => {
    const custom = overrides[key];
    const aliases = custom ? [String(custom)] : LEAD_BRIDGE.ALIASES[key];
    for (const alias of aliases) {
      const index = indexed[leadBridgeHeader_(alias)];
      if (index !== undefined) { result[key] = index; break; }
    }
  });
  return result;
}

function leadBridgeEnsureState_(sheet) {
  const names = Object.values(LEAD_BRIDGE.STATE);
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const missing = names.filter(name => !headers.includes(name));
  if (missing.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  }
  return leadBridgeColumnIndexes_(sheet);
}

function leadBridgeColumnIndexes_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const cols = {};
  headers.forEach((h, i) => { cols[h] = i + 1; });
  return cols;
}

function leadBridgeMark_(sheet, row, cols, dest, status, attempts, info) {
  const s = LEAD_BRIDGE.STATE;
  const statusKey = dest === 'CT' ? s.CT : s.AD;
  const countKey = dest === 'CT' ? s.CT_ATTEMPTS : s.AD_ATTEMPTS;
  const timeKey = dest === 'CT' ? s.CT_AT : s.AD_AT;
  const noteKey = dest === 'CT' ? s.CT_INFO : s.AD_INFO;
  sheet.getRange(row, cols[statusKey]).setValue(status);
  sheet.getRange(row, cols[countKey]).setValue(attempts);
  sheet.getRange(row, cols[timeKey]).setValue(new Date());
  sheet.getRange(row, cols[noteKey]).setValue(String(info || '').slice(0, 100));
}

function leadBridgeEligible_(status) {
  return ['', 'PENDING', 'RETRY'].includes(String(status || ''));
}

function leadBridgeNormalizePhone_(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0082')) digits = digits.slice(2);
  if (digits.startsWith('82') && digits.length >= 10 && digits.length <= 13) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('10') && digits.length === 10) {
    digits = '0' + digits;
  }
  return digits;
}

function leadBridgeHeader_(value) {
  return String(value == null ? '' : value).normalize('NFKC')
    .toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function leadBridgeText_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
  return String(value === null || value === undefined ? '' : value).trim();
}

function leadBridgeSheet_() {
  const p = PropertiesService.getScriptProperties();
  const sheetId = p.getProperty('SPREADSHEET_ID');
  const spreadsheet = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('SPREADSHEET_ID를 설정하거나 Google Sheet에서 스크립트를 여세요.');
  const name = p.getProperty('LEADS_SHEET_NAME');
  const sheet = name ? spreadsheet.getSheetByName(name) : spreadsheet.getSheets()[0];
  if (!sheet) throw new Error('리드 시트를 찾지 못했습니다: ' + name);
  if (sheet.getLastColumn() === 0) throw new Error('1행에 원본 데이터 열 제목이 있어야 합니다.');
  return sheet;
}

function leadBridgeEndpoints_() {
  const p = PropertiesService.getScriptProperties();
  const calltag = p.getProperty('CALLTAG_WEBHOOK_URL') || '';
  const advertiser = p.getProperty('ADVERTISER_URL') || '';
  if (!/^https:\/\/[^/]+\/api\/calltag\/v1\/hooks\/ctwh_[\w-]+$/.test(calltag)) {
    throw new Error('콜태그 Webhook HTTPS 주소를 CALLTAG_WEBHOOK_URL에 설정하세요.');
  }
  if (!/^https:\/\/[^/]+\/.+/.test(advertiser)) {
    throw new Error('광고주가 HTTPS를 지원하는지 확인하고 ADVERTISER_URL에 넣으세요. HTTP 전송은 금지합니다.');
  }
  const item = p.getProperty('ADVERTISER_ITEM') || '64';
  if (!/^\d+$/.test(item)) throw new Error('ADVERTISER_ITEM은 숫자여야 합니다.');
  return { calltag, advertiser, item };
}
