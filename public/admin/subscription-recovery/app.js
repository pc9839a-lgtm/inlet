const api = '/api/call/admin/subscription-reconcile';
const id = (value) => document.getElementById(value);
const orderPattern = /GPA\.\d{4}-\d{4}-\d{4}-\d{5}(?:\.\.\d+)?/i;
const productPattern = /\b(call_monthly|message_monthly|all_monthly)\b/i;
const maxOrders = 12;
let verified = null;
let busy = false;

function output(message, error = false) {
  id('progress').textContent = String(message);
  id('progress').classList.toggle('error', error);
}
function showError(message) {
  id('input-error').textContent = String(message);
  id('input-error').hidden = false;
}
function clearError() {
  id('input-error').textContent = '';
  id('input-error').hidden = true;
}
function resetPreview() {
  verified = null;
  id('apply').disabled = true;
  id('totals').hidden = true;
  id('results').hidden = true;
  id('result-rows').replaceChildren();
}
function parseOrders(raw) {
  const orders = [];
  const keys = new Set();
  for (const line of String(raw).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const orderId = line.match(orderPattern)?.[0];
    const productCode = line.match(productPattern)?.[0]?.toLowerCase();
    if (!orderId || !productCode) {
      throw new Error('각 줄에 GPA 주문번호와 상품코드를 함께 입력하세요.');
    }
    const key = orderId.toUpperCase() + ':' + productCode;
    if (keys.has(key)) continue;
    keys.add(key);
    orders.push({ orderId, productCode });
  }
  if (orders.length < 1 || orders.length > maxOrders) {
    throw new Error('중복 제외 1~12건만 검증할 수 있습니다.');
  }
  return orders;
}
async function callAdmin(body) {
  const response = await fetch(api, {
    method: 'POST',
    credentials: 'same-origin',
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) {
    throw new Error('관리자 로그인 세션이 필요합니다. Cloudflare Access에서 먼저 로그인하세요.');
  }
  const data = await response.json();
  if (!response.ok || data?.ok !== true) {
    const code = String(data?.code || data?.error || 'UNKNOWN').slice(0, 110);
    throw new Error('관리자 요청 실패 (HTTP ' + response.status + ', ' + code + ')');
  }
  return data;
}
async function lockedRun(button, work) {
  if (busy) return;
  busy = true;
  for (const name of ['preview','apply','refresh','reset']) id(name).disabled = true;
  try { await work(); }
  finally {
    busy = false;
    for (const name of ['preview','refresh','reset']) id(name).disabled = false;
    id('apply').disabled = !verified;
  }
}
function renderTable(data) {
  const rows = Array.isArray(data.results) ? data.results : [];
  const body = id('result-rows');
  body.replaceChildren();
  for (const result of rows) {
    const tr = document.createElement('tr');
    const cells = [
      Number(result.index) || '—',
      String(result.productCode || ''),
      result.providerPaid === true ? '확인' : '미확인',
      result.matchedExistingOwner === true ? '일치' : '연결 불가',
      String(result.state || '알 수 없음'),
    ];
    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = String(value);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  id('examined').textContent = String(Number(data.examined) || 0);
  id('paid').textContent = String(Number(data.providerPaid) || 0);
  id('matched').textContent = String(Number(data.matchedExistingOwner) || 0);
  id('totals').hidden = false;
  id('results').hidden = false;
}
id('orders').addEventListener('input', () => {
  resetPreview();
  clearError();
});
id('reset').addEventListener('click', () => {
  id('orders').value = '';
  resetPreview();
  clearError();
  output('입력값을 지웠습니다.');
});
id('preview').addEventListener('click', () => lockedRun(id('preview'), async () => {
  resetPreview();
  clearError();
  let orders;
  try {
    orders = parseOrders(id('orders').value);
  } catch (error) {
    showError(error.message);
    return;
  }
  output('Google Play에서 ' + orders.length + '건 검증 중입니다. 결제 DB는 변경하지 않습니다.');
  try {
    const data = await callAdmin({ orders, apply: false });
    renderTable(data);
    const complete = Number(data.examined) === orders.length
      && Number(data.providerPaid) === orders.length
      && Number(data.matchedExistingOwner) === orders.length
      && Array.isArray(data.results)
      && data.results.every((item) => item.state === 'verified_ready');
    if (complete) {
      verified = { orders, count: orders.length };
      output(orders.length + '건 모두 공식 결제·기존 회원 일치 확인. 이제 복구 적용이 가능합니다.');
    } else {
      output('일부 주문이 미확인 또는 회원 연결 불가입니다. 잘못된 유료 승인 방지를 위해 복구 버튼이 잠겼습니다.', true);
    }
  } catch (error) {
    output(error?.message || '검증 중 오류가 발생했습니다.', true);
  }
}));
id('apply').addEventListener('click', () => lockedRun(id('apply'), async () => {
  if (!verified) return;
  const batch = verified;
  // Never apply if edited after dry run, or if verification was incomplete.
  let current;
  try { current = parseOrders(id('orders').value); }
  catch (error) { output(error.message, true); resetPreview(); return; }
  if (JSON.stringify(current) !== JSON.stringify(batch.orders)) {
    output('주문 목록이 변경됐습니다. 먼저 다시 검증하세요.', true);
    resetPreview();
    return;
  }
  if (!window.confirm(batch.count + '건의 검증된 거래를 결제 원장에 저장하고, 구독 상태를 다시 확인하시겠습니까?')) return;
  output('검증된 거래를 적용 중입니다. 창을 닫지 마세요.');
  verified = null;
  try {
    const data = await callAdmin({ orders: batch.orders, apply: true });
    renderTable(data);
    const message = [
      '원장 기록 ' + Number(data.paymentRecorded || 0) + '건',
      '구독 재검증 ' + Number(data.subscriptionRefreshed || 0) + '건',
      '현재 활성 ' + Number(data.activeNow || 0) + '건',
      '회원 연결 누락 ' + Number(data.unmatchedPaidOrders || 0) + '건',
    ].join(' / ');
    output('적용 결과: ' + message + '. 자세한 상태는 아래 표를 확인하세요.');
  } catch (error) {
    output('적용 결과를 확인하지 못했습니다: ' + String(error.message || error) + '. 다시 적용하기 전에 관리자 결제 원장을 확인하세요.', true);
  }
}));
id('refresh').addEventListener('click', () => lockedRun(id('refresh'), async () => {
  if (!window.confirm('DB의 기존 구독 최대 5건을 Google Play에서 재검증합니다. 공식 검증이 성공한 경우에만 구독 상태가 갱신됩니다. 진행할까요?')) return;
  id('refresh-result').textContent = '기존 구독 재검증 중입니다.';
  try {
    const data = await callAdmin({});
    id('refresh-result').textContent =
      '재검증 ' + Number(data.examined || 0) + '건 / Google 확인 '
      + Number(data.providerVerified || 0) + '건 / 현재 활성 '
      + Number(data.activeNow || 0) + '건 / 검토 필요 '
      + Number(data.needsReview || 0) + '건. 결제 원장은 별도 복구가 필요합니다.';
  } catch (error) {
    id('refresh-result').textContent = String(error.message || error);
  }
}));