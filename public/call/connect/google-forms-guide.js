(()=>{
  const $=(id)=>document.getElementById(id);
  const GOOGLE_FORMS_SOURCE='Google Forms';
  const PLACEHOLDER='<YOUR_CALLTAG_WEBHOOK_URL>';
  let transientEndpointUrl='';
  let pendingGoogleFormsRotateId='';
  let rotateContextTimer=0;

  function googleFormsConnections(){
    try{
      return activeOnly(webhookConnections).filter((item)=>String(item?.sourceName||'').trim()===GOOGLE_FORMS_SOURCE);
    }catch{return []}
  }

  function googleFormsReadiness(item={}){
    const samples=Number(item.sampleCount||0);
    if(item.lastError)return{label:'확인 필요',className:'warn',hint:'최근 Webhook 처리 오류가 있습니다.'};
    if(item.mappingReady)return{label:'수집 준비',className:'good',hint:'전화번호 필드 매핑이 완료되었습니다.'};
    if(samples>0)return{label:'매핑 필요',className:'warn',hint:'샘플을 받았습니다. 전화번호 필드를 지정하세요.'};
    return{label:'테스트 필요',className:'',hint:'Google Form에서 테스트 응답을 1건 제출하세요.'};
  }

  function syncGoogleFormsStatus(){
    const items=googleFormsConnections();
    const count=items.length;
    const hasIssue=items.some((item)=>Boolean(item.lastError));
    const needsSetup=items.some((item)=>!item.mappingReady);
    const cardStatus=$('googleFormsStatus');
    const detailStatus=$('googleFormsDetailStatus');
    if(cardStatus){
      cardStatus.textContent=!count?'미연결':hasIssue?'확인 필요':needsSetup?'설정 필요':`${count}개 준비`;
      cardStatus.classList.toggle('on',count>0&&!hasIssue&&!needsSetup);
      cardStatus.classList.toggle('warn',count>0&&(hasIssue||needsSetup));
    }
    if(detailStatus){
      detailStatus.textContent=transientEndpointUrl?'스크립트 준비됨':!count?'Webhook 브리지':hasIssue?'확인 필요':needsSetup?'설정 필요':`${count}개 수집 준비`;
      detailStatus.classList.toggle('on',Boolean(transientEndpointUrl)||(count>0&&!hasIssue&&!needsSetup));
      detailStatus.classList.toggle('warn',!transientEndpointUrl&&count>0&&(hasIssue||needsSetup));
    }
  }

  function endpointLiteral(endpoint=''){
    return endpoint?JSON.stringify(endpoint):`'${PLACEHOLDER}'`;
  }

  function appsScriptTemplate(endpoint=transientEndpointUrl){
    return `const CALLTAG_WEBHOOK_URL = ${endpointLiteral(endpoint)};

function installCallTag() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Google Form에 연결된 Apps Script에서 실행해주세요.');

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'sendToCallTag')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendToCallTag')
    .forForm(form)
    .onFormSubmit()
    .create();
}

function sendToCallTag(e) {
  const form = e.source;
  const response = e.response;
  const answers = {};

  response.getItemResponses().forEach((itemResponse) => {
    const title = itemResponse.getItem().getTitle();
    const raw = itemResponse.getResponse();
    answers[title] = Array.isArray(raw) ? raw.join(', ') : String(raw == null ? '' : raw);
  });

  const responseId = response.getId() || Utilities.getUuid();
  const submittedAt = response.getTimestamp();
  const payload = {
    source: 'google_forms',
    form_id: form.getId(),
    form_title: form.getTitle(),
    response_id: responseId,
    submitted_at: submittedAt ? submittedAt.toISOString() : new Date().toISOString(),
    answers,
  };

  const result = UrlFetchApp.fetch(CALLTAG_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { 'Idempotency-Key': responseId },
    muteHttpExceptions: true,
  });

  const status = result.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('CallTag 전송 실패: HTTP ' + status);
  }
}`;
  }

  function setStep(index,text){
    const step=document.querySelectorAll('#googleFormsDetail .google-forms-step')[index];
    if(!step)return;
    const number=document.createElement('b');number.textContent=String(index+1);
    step.textContent='';step.append(number,document.createTextNode(text));
  }

  function renderAppsScript(){
    const code=$('googleFormsCode');
    if(code){
      code.textContent=appsScriptTemplate();
      code.dataset.endpointReady=transientEndpointUrl?'1':'0';
    }
    const copy=$('copyGoogleFormsScript');
    if(copy)copy.textContent=transientEndpointUrl?'URL 포함 Apps Script 복사':'Apps Script 복사';
    syncGoogleFormsStatus();
  }

  function isUsableEndpoint(value=''){
    return /^https:\/\/[^\s]+$/i.test(String(value).trim());
  }

  function showReadyInstructions(){
    setStep(0,'Google Forms용 Webhook을 만들었습니다.');
    setStep(1,'URL이 이미 포함된 Apps Script를 그대로 복사합니다.');
    setStep(2,'Google Form의 Apps Script에 붙여넣고 installCallTag를 1회 실행합니다.');
    setStep(3,'테스트 응답 후 Webhook 매핑에서 전화번호 필드를 지정합니다.');
    const copyTextNode=document.querySelector('#googleFormsDetail .guide-card p');
    if(copyTextNode)copyTextNode.textContent='방금 발급된 CallTag Webhook URL이 이미 포함된 스크립트입니다. 그대로 복사해 Google Form의 Apps Script 편집기에 붙여넣고 installCallTag를 한 번 실행하세요.';
  }

  function clearTransientEndpoint(){
    transientEndpointUrl='';
    pendingGoogleFormsRotateId='';
    if(rotateContextTimer){clearTimeout(rotateContextTimer);rotateContextTimer=0}
    renderAppsScript();
  }

  function acceptTransientEndpoint(endpoint){
    const value=String(endpoint||'').trim();
    if(!isUsableEndpoint(value))return false;
    transientEndpointUrl=value;
    pendingGoogleFormsRotateId='';
    if(rotateContextTimer){clearTimeout(rotateContextTimer);rotateContextTimer=0}
    renderAppsScript();
    showReadyInstructions();
    showDetail('googleFormsDetail');
    return true;
  }

  function captureSecretIfGoogleForms(){
    const secretBox=$('webhookSecret');
    const endpoint=secretBox?.querySelector('.secret-value')?.textContent?.trim()||'';
    if(!isUsableEndpoint(endpoint))return;
    const formSource=String($('webhookSource')?.value||'').trim();
    const secretTitle=secretBox?.querySelector('b')?.textContent||'';
    const isGoogleFormsCreate=formSource===GOOGLE_FORMS_SOURCE;
    const isGoogleFormsRotate=Boolean(pendingGoogleFormsRotateId)&&secretTitle.startsWith('새 Webhook URL');
    if(isGoogleFormsCreate||isGoogleFormsRotate)acceptTransientEndpoint(endpoint);
  }

  function rememberRotateContext(event){
    const button=event.target?.closest?.('button');
    if(!button||button.textContent.trim()!=='URL 교체')return;
    const card=button.closest('[data-webhook-connection-id]');
    const id=String(card?.dataset?.webhookConnectionId||'');
    const item=(webhookConnections||[]).find((entry)=>String(entry?.id||'')===id);
    pendingGoogleFormsRotateId=String(item?.sourceName||'').trim()===GOOGLE_FORMS_SOURCE?id:'';
    if(rotateContextTimer)clearTimeout(rotateContextTimer);
    rotateContextTimer=window.setTimeout(()=>{pendingGoogleFormsRotateId='';rotateContextTimer=0},30000);
  }

  function ensureGoogleFormsConnectionSection(){
    let root=$('googleFormsConnectionList');
    if(root)return root;
    const guide=document.querySelector('#googleFormsDetail .google-forms-guide');
    if(!guide)return null;
    const section=document.createElement('section');section.className='google-forms-connections';
    const head=document.createElement('div');head.className='google-forms-connections-head';
    const titleWrap=document.createElement('div');
    const title=document.createElement('h3');title.textContent='Google Forms 연결 상태';
    const desc=document.createElement('p');desc.textContent='테스트 응답 수신과 전화번호 매핑 여부를 여기서 바로 확인합니다.';
    titleWrap.append(title,desc);head.appendChild(titleWrap);
    root=document.createElement('div');root.id='googleFormsConnectionList';root.className='list google-forms-list';
    section.append(head,root);
    const guideCard=guide.querySelector('.guide-card');
    guide.insertBefore(section,guideCard||null);
    return root;
  }

  function appendMetaValue(meta,label,value){
    const row=document.createElement('div');
    const b=document.createElement('b');b.textContent=label;
    const span=document.createElement('span');span.textContent=value;
    row.append(b,span);meta.appendChild(row);
  }

  function findWebhookCard(connectionId){
    const id=String(connectionId||'');
    return [...document.querySelectorAll('#webhookList [data-webhook-connection-id]')]
      .find((card)=>String(card.dataset.webhookConnectionId||'')===id)||null;
  }

  function openGoogleFormsMapper(connectionId){
    showDetail('webhookDetail');
    window.requestAnimationFrame(()=>{
      const card=findWebhookCard(connectionId);
      const button=card?.querySelector('[data-webhook-mapper-trigger]');
      if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
      if(card&&button&&typeof openWebhookMapper==='function')openWebhookMapper(connectionId,card,button);
    });
  }

  function openGoogleFormsWebhook(connectionId){
    showDetail('webhookDetail');
    window.requestAnimationFrame(()=>{
      const card=findWebhookCard(connectionId);
      card?.scrollIntoView({behavior:'smooth',block:'center'});
    });
  }

  function renderGoogleFormsConnections(){
    const root=ensureGoogleFormsConnectionSection();
    if(!root)return;
    const items=googleFormsConnections();
    root.textContent='';
    if(!items.length){
      const empty=document.createElement('div');empty.className='empty';empty.textContent='Google Forms용 Webhook을 만들면 연결 상태가 여기에 표시됩니다.';root.appendChild(empty);syncGoogleFormsStatus();return;
    }
    for(const item of items){
      const readiness=googleFormsReadiness(item);
      const card=document.createElement('div');card.className='connection-card google-forms-connection-card';card.dataset.googleFormsConnectionId=String(item.id||'');
      const top=document.createElement('div');top.className='connection-top';
      const main=document.createElement('div');main.className='row-main';
      const name=document.createElement('strong');name.textContent=item.name||'Google Forms';
      const sub=document.createElement('span');sub.textContent=readiness.hint;
      main.append(name,sub);
      const badge=document.createElement('span');badge.className=`health-badge ${readiness.className}`.trim();badge.textContent=readiness.label;
      top.append(main,badge);
      const meta=document.createElement('div');meta.className='item-meta';
      appendMetaValue(meta,'최근 수신',formatTime(item.lastReceivedAt));
      appendMetaValue(meta,'테스트 샘플',`${Number(item.sampleCount||0)}건`);
      appendMetaValue(meta,'전화번호 매핑',item.mappingReady?`v${item.mappingVersion||1} 완료`:'설정 필요');
      appendMetaValue(meta,'원문 보관',`${Number(item.rawRetentionDays||7)}일`);
      const actions=document.createElement('div');actions.className='row-actions';
      const mapper=document.createElement('button');mapper.type='button';mapper.className=`row-action ${item.mappingReady?'':'primary-small'}`.trim();mapper.textContent=item.mappingReady?'매핑 보기':'전화번호 매핑';mapper.onclick=()=>openGoogleFormsMapper(item.id);
      const manage=document.createElement('button');manage.type='button';manage.className='row-action';manage.textContent='Webhook 관리';manage.onclick=()=>openGoogleFormsWebhook(item.id);
      actions.append(mapper,manage);
      card.append(top,meta,actions);root.appendChild(card);
    }
    syncGoogleFormsStatus();
  }

  function prepareWebhook(){
    clearTransientEndpoint();
    showDetail('webhookDetail');
    const form=$('webhookCreateForm');
    if(form?.classList.contains('hidden'))$('toggleWebhookCreate')?.click();
    const name=$('webhookName');
    const source=$('webhookSource');
    const retention=$('webhookRetention');
    if(name&&!name.value)name.value='Google Forms';
    if(source)source.value=GOOGLE_FORMS_SOURCE;
    if(retention)retention.value='7';
    notice($('webhookNotice'),'Google Forms용 Webhook 설정을 채웠습니다. 생성하면 발급 URL이 Apps Script에 자동으로 포함됩니다.');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  $('openGoogleForms')?.addEventListener('click',()=>{renderGoogleFormsConnections();showDetail('googleFormsDetail')});
  document.querySelector('[data-section="googleFormsDetail"]')?.addEventListener('click',renderGoogleFormsConnections);
  $('prepareGoogleFormsWebhook')?.addEventListener('click',prepareWebhook);
  $('openGoogleFormsMapper')?.addEventListener('click',()=>{
    const first=googleFormsConnections()[0];
    if(first?.id){openGoogleFormsMapper(first.id);return}
    showDetail('webhookDetail');
    $('webhookList')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('copyGoogleFormsScript')?.addEventListener('click',(event)=>copyText(appsScriptTemplate(),event.currentTarget));
  $('webhookList')?.addEventListener('click',rememberRotateContext,true);

  document.addEventListener('calltag:connect-ui-updated',(event)=>{
    if(event?.detail?.area==='webhook'){renderGoogleFormsConnections();syncGoogleFormsStatus()}
    if(event?.detail?.area==='secret')captureSecretIfGoogleForms();
  });

  const loginPanel=$('loginPanel');
  if(loginPanel&&typeof MutationObserver==='function'){
    const authObserver=new MutationObserver(()=>{
      if(!loginPanel.classList.contains('hidden'))clearTransientEndpoint();
    });
    authObserver.observe(loginPanel,{attributes:true,attributeFilter:['class']});
  }

  ensureGoogleFormsConnectionSection();
  renderAppsScript();
  renderGoogleFormsConnections();
  syncGoogleFormsStatus();
})();