(()=>{
  const $=(id)=>document.getElementById(id);
  const GOOGLE_FORMS_SOURCE='Google Forms';

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
      detailStatus.textContent=count?`${count}개 연결`:'Webhook 브리지';
      detailStatus.classList.toggle('on',count>0);
    }
  }

  function appsScriptTemplate(){
    return `const CALLTAG_WEBHOOK_URL = '<YOUR_CALLTAG_WEBHOOK_URL>';

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

  function renderAppsScript(){
    const code=$('googleFormsCode');
    if(code)code.textContent=appsScriptTemplate();
  }

  function prepareWebhook(){
    showDetail('webhookDetail');
    const form=$('webhookCreateForm');
    if(form?.classList.contains('hidden'))$('toggleWebhookCreate')?.click();
    const name=$('webhookName');
    const source=$('webhookSource');
    const retention=$('webhookRetention');
    if(name&&!name.value)name.value='Google Forms';
    if(source)source.value=GOOGLE_FORMS_SOURCE;
    if(retention)retention.value='7';
    notice($('webhookNotice'),'Google Forms용 Webhook 설정을 채웠습니다. 생성 후 한 번만 표시되는 URL을 Apps Script의 <YOUR_CALLTAG_WEBHOOK_URL> 자리에 붙여넣으세요.');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  $('openGoogleForms')?.addEventListener('click',()=>showDetail('googleFormsDetail'));
  $('prepareGoogleFormsWebhook')?.addEventListener('click',prepareWebhook);
  $('openGoogleFormsMapper')?.addEventListener('click',()=>{
    showDetail('webhookDetail');
    $('webhookList')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('copyGoogleFormsScript')?.addEventListener('click',(event)=>copyText(appsScriptTemplate(),event.currentTarget));

  document.addEventListener('calltag:connect-ui-updated',(event)=>{
    if(event?.detail?.area==='webhook')syncGoogleFormsStatus();
  });

  renderAppsScript();
  syncGoogleFormsStatus();
})();