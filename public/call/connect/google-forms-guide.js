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

  function syncGoogleFormsStatus(){
    const count=googleFormsConnections().length;
    const cardStatus=$('googleFormsStatus');
    const detailStatus=$('googleFormsDetailStatus');
    if(cardStatus){
      cardStatus.textContent=count?`${count}개 연결`:'미연결';
      cardStatus.classList.toggle('on',count>0);
    }
    if(detailStatus){
      detailStatus.textContent=transientEndpointUrl?'스크립트 준비됨':count?`${count}개 연결`:'Webhook 브리지';
      detailStatus.classList.toggle('on',Boolean(transientEndpointUrl)||count>0);
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

  $('openGoogleForms')?.addEventListener('click',()=>showDetail('googleFormsDetail'));
  $('prepareGoogleFormsWebhook')?.addEventListener('click',prepareWebhook);
  $('openGoogleFormsMapper')?.addEventListener('click',()=>{
    showDetail('webhookDetail');
    $('webhookList')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('copyGoogleFormsScript')?.addEventListener('click',(event)=>copyText(appsScriptTemplate(),event.currentTarget));
  $('webhookList')?.addEventListener('click',rememberRotateContext,true);

  document.addEventListener('calltag:connect-ui-updated',(event)=>{
    if(event?.detail?.area==='webhook')syncGoogleFormsStatus();
    if(event?.detail?.area==='secret')captureSecretIfGoogleForms();
  });

  const loginPanel=$('loginPanel');
  if(loginPanel&&typeof MutationObserver==='function'){
    const authObserver=new MutationObserver(()=>{
      if(!loginPanel.classList.contains('hidden'))clearTransientEndpoint();
    });
    authObserver.observe(loginPanel,{attributes:true,attributeFilter:['class']});
  }

  renderAppsScript();
  syncGoogleFormsStatus();
})();