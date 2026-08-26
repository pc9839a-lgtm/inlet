const E2E_ENDPOINT='/api/calltag/v1/e2e';
const E2E_CONFIRM='CREATE_CALLTAG_E2E_TEST_LEAD';
let e2ePanelReady=false;
let e2eLastRunId='';

function e2eStageMeta(status={}){
  if(status.stage==='IMPORTED')return {label:'ACK 완료',className:'good',detail:'서버 수신 → FCM → 앱 pull/import → ACK까지 완료됐습니다.'};
  if(status.stage==='REJECTED')return {label:'앱 거절',className:'bad',detail:status.result||'앱이 테스트 문의 가져오기를 거절했습니다.'};
  if(status.stage==='APP_FETCHED')return {label:'앱 가져감',className:'warn',detail:'앱이 문의를 가져갔습니다. ACK 완료를 기다리는 중입니다.'};
  return {label:'서버 수신',className:'active',detail:'서버에 테스트 문의가 생성됐습니다. 앱 가져오기를 기다리는 중입니다.'};
}

function e2eBuildPanel(){
  if(e2ePanelReady)return;
  const host=$('activityDetail');
  const anchor=host?.querySelector('.activity-summary');
  if(!host||!anchor)return;

  const box=document.createElement('section');box.id='e2ePanel';box.className='create-box';
  const head=document.createElement('div');head.className='panel-head';
  const titleWrap=document.createElement('div');
  const title=document.createElement('h3');title.textContent='E2E 테스트';
  const copy=document.createElement('p');copy.className='muted';copy.textContent='테스트 문의를 서버에 생성하고 앱 전달·ACK까지 실제 흐름을 확인합니다.';
  titleWrap.append(title,copy);
  const badge=document.createElement('span');badge.id='e2eModeBadge';badge.className='status';badge.textContent='확인 중';
  head.append(titleWrap,badge);

  const warning=document.createElement('div');warning.id='e2eWarning';warning.className='health-message show warn';warning.textContent='실행하면 입력한 전화번호로 실제 테스트 문의가 생성되어 콜태그 고객 흐름에 들어갑니다. 테스트용 번호를 직접 입력하세요.';

  const form=document.createElement('form');form.id='e2eForm';form.className='form-grid';
  const nameField=document.createElement('div');nameField.className='field';
  const nameLabel=document.createElement('label');nameLabel.htmlFor='e2eName';nameLabel.textContent='테스트 고객명';
  const nameInput=document.createElement('input');nameInput.id='e2eName';nameInput.maxLength=120;nameInput.value='콜태그 E2E 테스트';
  nameField.append(nameLabel,nameInput);
  const phoneField=document.createElement('div');phoneField.className='field';
  const phoneLabel=document.createElement('label');phoneLabel.htmlFor='e2ePhone';phoneLabel.textContent='테스트 전화번호';
  const phoneInput=document.createElement('input');phoneInput.id='e2ePhone';phoneInput.inputMode='tel';phoneInput.autocomplete='off';phoneInput.placeholder='010-0000-0000';phoneInput.required=true;phoneInput.maxLength=40;
  phoneField.append(phoneLabel,phoneInput);
  const contentField=document.createElement('div');contentField.className='field full';
  const contentLabel=document.createElement('label');contentLabel.htmlFor='e2eContent';contentLabel.textContent='문의 내용';
  const contentInput=document.createElement('input');contentInput.id='e2eContent';contentInput.maxLength=500;contentInput.value='콜태그 외부 문의 E2E 테스트입니다.';
  contentField.append(contentLabel,contentInput);
  const run=document.createElement('button');run.id='runE2e';run.className='primary';run.type='submit';run.textContent='테스트 문의 생성';run.disabled=true;
  form.append(nameField,phoneField,contentField,run);

  const noticeBox=document.createElement('div');noticeBox.id='e2eNotice';noticeBox.className='notice';
  const result=document.createElement('div');result.id='e2eResult';result.className='hidden';
  const statusButton=document.createElement('button');statusButton.id='checkE2eStatus';statusButton.className='secondary';statusButton.type='button';statusButton.textContent='상태 확인';statusButton.disabled=true;
  result.appendChild(statusButton);

  box.append(head,warning,form,noticeBox,result);
  host.insertBefore(box,anchor);
  form.onsubmit=e2eRun;
  statusButton.onclick=()=>e2eCheckStatus();
  e2ePanelReady=true;
  document.dispatchEvent(new CustomEvent('calltag:connect-ui-updated',{detail:{area:'e2e'}}));
}

async function e2eLoadReadiness(){
  e2eBuildPanel();
  const badge=$('e2eModeBadge');
  const run=$('runE2e');
  if(!badge||!run)return;
  try{
    const data=await api(E2E_ENDPOINT);
    const readiness=data.readiness||{};
    if(readiness.enabled){
      badge.textContent=readiness.firebaseConfigured?'테스트 가능':'FCM 설정 확인';
      badge.className=`status ${readiness.firebaseConfigured?'on':'warn'}`;
      run.disabled=false;
      if(!readiness.firebaseConfigured)notice($('e2eNotice'),'테스트 문의 생성은 가능하지만 Firebase 설정이 없어 실시간 FCM 전송은 확인할 수 없습니다.','error');
    }else{
      badge.textContent='테스트 모드 꺼짐';badge.className='status';run.disabled=true;
      notice($('e2eNotice'),'서버에서 CALLTAG_E2E_TEST_ENABLED=1을 설정해야 실행할 수 있습니다.','error');
    }
  }catch(error){
    if(error.status===401||error.status===403){requireLogin();return}
    badge.textContent='확인 실패';badge.className='status bad';run.disabled=true;notice($('e2eNotice'),error.message,'error');
  }
}

async function e2eRun(event){
  event.preventDefault();
  const button=$('runE2e');button.disabled=true;button.textContent='생성 중...';clearNotice($('e2eNotice'));
  const phone=$('e2ePhone').value.trim();
  if(!phone){notice($('e2eNotice'),'테스트 전화번호를 입력하세요.','error');button.disabled=false;button.textContent='테스트 문의 생성';return}
  try{
    const data=await api(E2E_ENDPOINT,{method:'POST',body:{
      confirm:E2E_CONFIRM,
      name:$('e2eName').value,
      phone,
      content:$('e2eContent').value,
    }});
    const test=data.test||{};
    e2eLastRunId=String(test.runId||'');
    const push=test.push||{};
    const pushText=push.error?'FCM 전송 실패':push.sent>0?`FCM ${push.sent}/${push.attempted} 전송`:(push.configured?'등록 기기 없음':'FCM 미설정');
    notice($('e2eNotice'),`테스트 문의를 생성했습니다. ${test.phoneMasked||''} · ${pushText}`,'ok');
    $('checkE2eStatus').disabled=!e2eLastRunId;
    $('e2eResult').classList.remove('hidden');
    await e2eCheckStatus();
    activityLoaded=false;
  }catch(error){
    if(error.status===401||error.status===403){if(error.code==='CALLTAG_E2E_DISABLED'){notice($('e2eNotice'),error.message,'error');return}requireLogin();return}
    notice($('e2eNotice'),error.message,'error');
  }finally{button.disabled=false;button.textContent='테스트 문의 생성'}
}

async function e2eCheckStatus(){
  if(!e2eLastRunId)return;
  const button=$('checkE2eStatus');button.disabled=true;button.textContent='확인 중...';
  try{
    const data=await api(`${E2E_ENDPOINT}?runId=${encodeURIComponent(e2eLastRunId)}`);
    e2eRenderStatus(data.status||{});
  }catch(error){
    if(error.status===401||error.status===403){requireLogin();return}
    notice($('e2eNotice'),error.message,'error');
  }finally{button.disabled=false;button.textContent='상태 확인'}
}

function e2eRenderStatus(status={}){
  const result=$('e2eResult');
  const old=result.querySelector('[data-e2e-status]');if(old)old.remove();
  const card=document.createElement('div');card.dataset.e2eStatus='1';card.className='connection-card';card.style.marginBottom='10px';
  const top=document.createElement('div');top.className='connection-top';
  const main=document.createElement('div');main.className='row-main';
  const name=document.createElement('strong');name.textContent=status.customer?.name||'콜태그 E2E 테스트';
  const sub=document.createElement('span');sub.textContent=[status.customer?.phoneMasked,status.runId].filter(Boolean).join(' · ');
  main.append(name,sub);
  const meta=e2eStageMeta(status);
  const badge=document.createElement('span');badge.className=`health-badge ${meta.className}`;badge.textContent=meta.label;
  top.append(main,badge);card.appendChild(top);

  const grid=document.createElement('div');grid.className='activity-meta';
  const rows=[
    ['서버 수신',activityFormatTime(status.createdAt||status.submittedAt)],
    ['앱 가져감',activityFormatTime(status.deliveredAt)],
    ['ACK',activityFormatTime(status.importedAt)],
    ['Push',status.push?.result||'기록 없음'],
  ];
  for(const [label,value] of rows){const box=document.createElement('div');const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;box.append(b,span);grid.appendChild(box)}
  card.appendChild(grid);
  const message=document.createElement('div');message.className=`health-message show ${meta.className==='good'?'good':meta.className==='bad'?'bad':'warn'}`;message.textContent=meta.detail;card.appendChild(message);
  result.insertBefore(card,$('checkE2eStatus'));
  document.dispatchEvent(new CustomEvent('calltag:connect-ui-updated',{detail:{area:'e2e-status'}}));
}

const e2eActivityTab=document.querySelector('[data-section="activityDetail"]');
if(e2eActivityTab)e2eActivityTab.addEventListener('click',()=>e2eLoadReadiness(),{once:false});