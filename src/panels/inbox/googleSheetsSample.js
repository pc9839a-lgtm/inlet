export const GOOGLE_SHEETS_APPS_SCRIPT = `const SHEET_NAME = '접수함';
const BASE_HEADERS = ['접수일시'];
const TEST_PAYLOAD = {
  createdAt: new Date().toISOString(),
  sheetName: SHEET_NAME,
  lead: {
    createdAt: new Date().toISOString(),
    answers: [
      { label: '이름', value: '테스트' },
      { label: '연락처', value: '01000000000' },
      { label: '문의내용', value: '수동 실행 테스트' },
      { label: '관심 타입', value: '84A' },
      { label: '예산대', value: '5억-7억' }
    ]
  }
};

function doPost(e) {
  const data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : TEST_PAYLOAD;
  const lead = data.lead || {};
  const fields = submittedFields(lead);
  const sheet = getSheet(data.sheetName || SHEET_NAME);
  const headers = ensureHeaders(sheet, Object.keys(fields));
  const values = {
    '접수일시': lead.createdAt || data.createdAt || new Date().toISOString(),
    ...fields
  };
  sheet.appendRow(headers.map((header) => values[header] || ''));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function submittedFields(lead) {
  const fields = {};
  (lead.answers || []).forEach(function(answer) {
    addField(fields, answer.label || answer.name || answer.id, answer.value || answer.text);
  });
  Object.keys(lead.fields || {}).forEach(function(key) {
    addField(fields, key, lead.fields[key]);
  });
  return fields;
}

function addField(fields, label, value) {
  const key = String(label || '').trim();
  if (!key || fields[key] !== undefined || isSystemField(key) || !hasValue(value)) return;
  fields[key] = cellValue(value);
}

function isSystemField(key) {
  return /^(sourceUrl|source_url|referrer|referer|utmSource|utm_source|utmMedium|utm_medium|utmCampaign|utm_campaign|createdAt|submittedAt)$/i.test(String(key || '').trim());
}

function hasValue(value) {
  if (Array.isArray(value)) return value.some(hasValue);
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return String(value == null ? '' : value).trim() !== '';
}

function cellValue(value) {
  if (Array.isArray(value)) return value.map(cellValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value == null ? '' : value);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders(sheet, fieldHeaders) {
  const customHeaders = (fieldHeaders || []).map((header) => String(header || '').trim()).filter(Boolean);
  const required = BASE_HEADERS.concat(customHeaders);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(required);
    return required;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map((value) => String(value || '').trim()).filter(Boolean);
  const existingWidth = Math.max(sheet.getLastColumn(), 1);
  const writeWidth = Math.max(existingWidth, required.length);
  const writeRow = required.concat(Array(Math.max(writeWidth - required.length, 0)).fill(''));
  const changed = headers.join('|') !== required.join('|') || existingWidth !== required.length;
  if (changed) sheet.getRange(1, 1, 1, writeWidth).setValues([writeRow]);
  return required;
}

function doGet() {
  return ContentService.createTextOutput('Pagero Google Sheets webhook is ready.');
}`;
