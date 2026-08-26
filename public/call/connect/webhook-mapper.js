const WEBHOOK_MAPPING_ROLES=[
  {key:'name',label:'고객명',hint:'선택'},
  {key:'phone',label:'전화번호',hint:'필수',required:true},
  {key:'email',label:'이메일',hint:'선택'},
  {key:'content',label:'문의내용',hint:'선택'},
  {key:'externalId',label:'외부 문의 ID',hint:'선택'},
  {key:'submittedAt',label:'접수일시',hint:'선택'},
];

function decorateWebhookMapperCards(){
  const root=$('webhookList');
  if(!root||typeof webhookConnections==='undefined'||!Array.isArray(webhookConnections))return;
  const cards=[...root.querySelectorAll('.connection-card[data-webhook-connection-id]')];
  for(const card of cards){
    const connectionId=String(card.dataset.webhookConnectionId||'');
    const item=webhookConnections.find((candidate)=>String(candidate?.id||'')===connectionId&&candidate?.status!=='revoked');
    if(!item?.id)continue;
    const mapperButton=card.querySelector('[data-webhook-mapper-trigger]');
    if(!mapperButton)continue;
    mapperButton.disabled=false;
    mapperButton.textContent='매핑 설정';
    mapperButton.classList.toggle('primary-small',!item.mappingReady);
    mapperButton.onclick=()=>openWebhookMapper(item.id,card,mapperButton);
  }
}

function mapperNotice(panel,message,type='ok'){
  const box=panel.querySelector('[data-mapper-notice]');
  if(!box)return;
  box.textContent=message;
  box.className=`mapper-notice show ${type}`;
}

function clearMapperNotice(panel){
  const box=panel.querySelector('[data-mapper-notice]');
  if(!box)return;
  box.textContent='';
  box.className='mapper-notice';
}

function mapperStatusLabel(status=''){
  const labels={MAPPING_REQUIRED:'매핑 필요',RECEIVED:'수신됨',MAPPED:'처리 완료',REJECTED:'처리 실패'};
  return labels[String(status||'').toUpperCase()]||String(status||'확인 전');
}

function mapperStatusClass(status=''){
  const value=String(status||'').toUpperCase();
  if(value==='MAPPED')return 'good';
  if(value==='REJECTED')return 'bad';
  if(value==='MAPPING_REQUIRED')return 'warn';
  return '';
}

function truncateMapperText(value='',limit=90){
  const text=String(value??'').replace(/\s+/g,' ').trim();
  return text.length>limit?`${text.slice(0,limit)}…`:text;
}

function mapperFieldLookup(sample){
  const fields=Array.isArray(sample?.mapper?.fields)?sample.mapper.fields:[];
  return new Map(fields.map((field)=>[String(field.pointer||''),field]));
}

function selectedMapperSample(state){
  const id=Number(state.sampleSelect?.value||0);
  return state.samples.find((sample)=>Number(sample.id||0)===id)||state.samples[0]||null;
}

function populateMapperDatalist(state,sample){
  const list=state.datalist;
  if(!list)return;
  list.textContent='';
  const fields=Array.isArray(sample?.mapper?.fields)?sample.mapper.fields:[];
  for(const field of fields){
    const option=document.createElement('option');
    option.value=String(field.pointer||'');
    const preview=truncateMapperText(field.preview||'',70);
    option.label=preview?`${field.type||'값'} · ${preview}`:String(field.type||'값');
    list.appendChild(option);
  }
}

function updateMapperFieldPreviews(state){
  const sample=selectedMapperSample(state);
  const lookup=mapperFieldLookup(sample);
  for(const role of WEBHOOK_MAPPING_ROLES){
    const input=state.inputs[role.key];
    const preview=state.previews[role.key];
    if(!input||!preview)continue;
    const pointer=input.value.trim();
    const field=lookup.get(pointer);
    preview.textContent=!pointer?'미지정':field?.preview?truncateMapperText(field.preview,110):'이 샘플에서 값 확인 안 됨';
    preview.classList.toggle('muted-value',!field?.preview);
  }
}

function renderMapperPayload(state){
  const sample=selectedMapperSample(state);
  const meta=state.sampleMeta;
  const raw=state.payload;
  const replay=state.replayButton;
  if(!sample){
    if(meta)meta.textContent='아직 수신된 샘플이 없습니다.';
    if(raw)raw.textContent='Webhook URL로 테스트 JSON을 1건 전송한 뒤 샘플 새로고침을 눌러주세요.';
    if(replay)replay.disabled=true;
    return;
  }
  if(meta){
    const parts=[`#${sample.id}`,mapperStatusLabel(sample.status),formatTime(sample.receivedAt)];
    if(sample.errorMessage)parts.push(truncateMapperText(sample.errorMessage,120));
    meta.textContent=parts.join(' · ');
  }
  if(raw){
    let value='';
    try{value=JSON.stringify(sample.payload,null,2)}catch{value='샘플 원문을 표시할 수 없습니다.'}
    raw.textContent=value.length>8000?`${value.slice(0,8000)}\n… 화면 미리보기는 8,000자로 제한됩니다.`:value;
  }
  if(replay){
    replay.disabled=!state.connection.mappingReady||String(sample.status||'').toUpperCase()==='MAPPED';
    replay.textContent=String(sample.status||'').toUpperCase()==='MAPPED'?'이미 처리됨':'선택 샘플 재처리';
  }
}

function applyMapperSuggestion(state){
  const sample=selectedMapperSample(state);
  const draft=sample?.mapper?.draftMapping||{};
  let applied=0;
  for(const role of WEBHOOK_MAPPING_ROLES){
    const pointer=String(draft[role.key]||'');
    if(pointer&&state.inputs[role.key]){state.inputs[role.key].value=pointer;applied+=1}
  }
  updateMapperFieldPreviews(state);
  mapperNotice(state.panel,applied?`자동 추천 ${applied}개를 적용했습니다. 전화번호를 포함해 값이 맞는지 확인해주세요.`:'확신할 수 있는 자동 추천이 없습니다. 목록에서 직접 선택해주세요.',applied?'ok':'warn');
}

function currentMapperMapping(state){
  const existing=state.connection?.mapping||{};
  const mapping={customFields:Array.isArray(existing.customFields)?existing.customFields:[]};
  for(const role of WEBHOOK_MAPPING_ROLES)mapping[role.key]=String(state.inputs[role.key]?.value||'').trim();
  return mapping;
}

function syncMapperConnectionState(state,connection){
  if(!connection?.id)return;
  state.connection=connection;
  const index=webhookConnections.findIndex((item)=>item.id===connection.id);
  if(index>=0)webhookConnections[index]=connection;
  const badge=state.card.querySelector('.health-badge');
  if(badge){badge.className=`health-badge ${connection.lastError?'warn':connection.mappingReady?'good':''}`;badge.textContent=connection.lastError?'확인 필요':connection.mappingReady?'수집 준비':'매핑 필요'}
  const metaRows=[...state.card.querySelectorAll('.item-meta > div')];
  const mappingValue=metaRows[2]?.querySelector('span');
  if(mappingValue)mappingValue.textContent=connection.mappingReady?`v${connection.mappingVersion||1} 적용`:'설정 필요';
  const mapperButton=state.card.querySelector('[data-webhook-mapper-trigger]');
  if(mapperButton){mapperButton.textContent='매핑 설정';mapperButton.classList.toggle('primary-small',!connection.mappingReady)}
  if(!connection.lastError){const warning=state.card.querySelector('.health-message.warn');if(warning)warning.remove()}
  renderMapperPayload(state);
}

async function saveWebhookMapping(state,button){
  clearMapperNotice(state.panel);
  const mapping=currentMapperMapping(state);
  if(!mapping.phone){mapperNotice(state.panel,'전화번호 필드는 반드시 지정해야 합니다.','error');state.inputs.phone?.focus();return}
  if(!mapping.phone.startsWith('/')){mapperNotice(state.panel,'필드 경로는 / 로 시작하는 JSON Pointer 형식이어야 합니다.','error');state.inputs.phone?.focus();return}
  button.disabled=true;const original=button.textContent;button.textContent='저장 중...';
  try{
    const data=await api('/api/calltag/v1/connections',{method:'PATCH',body:{action:'update_mapping',connectionId:state.connection.id,mapping}});
    syncMapperConnectionState(state,data.connection||{...state.connection,mapping,mappingReady:true,mappingVersion:Number(state.connection.mappingVersion||0)+1,lastError:''});
    mapperNotice(state.panel,`필드 매핑 v${state.connection.mappingVersion||1}을 저장했습니다. 이전 미처리 샘플은 아래에서 재처리할 수 있습니다.`);
  }catch(error){
    if(error.status===401||error.status===403){requireLogin();return}
    mapperNotice(state.panel,error.message,'error');
  }finally{button.disabled=false;button.textContent=original}
}

async function replayWebhookSample(state,button){
  const sample=selectedMapperSample(state);
  if(!sample?.id)return;
  button.disabled=true;const original=button.textContent;button.textContent='재처리 중...';
  try{
    const result=await api('/api/calltag/v1/connections',{method:'PATCH',body:{action:'replay_raw',connectionId:state.connection.id,rawEventId:Number(sample.id)}});
    mapperNotice(state.panel,result.result==='DUPLICATE_IGNORED'?'이미 처리된 문의라 중복 생성하지 않았습니다.':'샘플을 CallTag 문의로 처리했습니다.');
    await refreshWebhookMapper(state);
  }catch(error){
    if(error.status===401||error.status===403){requireLogin();return}
    mapperNotice(state.panel,error.message,'error');
  }finally{button.disabled=false;button.textContent=original}
}

function hydrateMapperInputs(state){
  const existing=state.connection?.mapping||{};
  const sample=selectedMapperSample(state);
  const draft=sample?.mapper?.draftMapping||{};
  for(const role of WEBHOOK_MAPPING_ROLES){
    const current=String(existing[role.key]||'');
    const suggested=String(draft[role.key]||'');
    if(state.inputs[role.key])state.inputs[role.key].value=current||suggested;
  }
  updateMapperFieldPreviews(state);
}

function renderWebhookMapperPanel(panel,data,card){
  panel.textContent='';
  const connection=data.connection||webhookConnections.find((item)=>String(item.id||'')===String(card.dataset.webhookConnectionId||''))||{};
  const samples=Array.isArray(data.samples)?data.samples:[];
  const state={panel,card,connection,samples,inputs:{},previews:{}};
  panel._webhookMapperState=state;

  const head=document.createElement('div');head.className='mapper-head';
  const titleWrap=document.createElement('div');
  const title=document.createElement('h4');title.textContent='Webhook 필드 매핑';
  const desc=document.createElement('p');desc.textContent='수신 샘플을 기준으로 외부 JSON 필드를 CallTag 고객 정보에 연결합니다.';
  titleWrap.append(title,desc);
  const version=document.createElement('span');version.className=`health-badge ${connection.mappingReady?'good':'warn'}`;version.textContent=connection.mappingReady?`v${connection.mappingVersion||1}`:'설정 필요';
  head.append(titleWrap,version);

  const sampleBar=document.createElement('div');sampleBar.className='mapper-sample-bar';
  const sampleLabel=document.createElement('label');sampleLabel.textContent='수신 샘플';
  const sampleSelect=document.createElement('select');sampleSelect.className='mapper-sample-select';state.sampleSelect=sampleSelect;
  if(samples.length){
    for(const sample of samples){const option=document.createElement('option');option.value=String(sample.id||'');option.textContent=`#${sample.id} · ${mapperStatusLabel(sample.status)} · ${formatTime(sample.receivedAt)}`;sampleSelect.appendChild(option)}
  }else{const option=document.createElement('option');option.value='';option.textContent='샘플 없음';sampleSelect.appendChild(option);sampleSelect.disabled=true}
  const refresh=document.createElement('button');refresh.type='button';refresh.className='row-action';refresh.textContent='샘플 새로고침';refresh.onclick=()=>refreshWebhookMapper(state,refresh);
  sampleBar.append(sampleLabel,sampleSelect,refresh);

  const datalist=document.createElement('datalist');datalist.id=`mapperFields-${String(connection.id||'').replace(/[^a-zA-Z0-9_-]/g,'')}`;state.datalist=datalist;
  const grid=document.createElement('div');grid.className='mapper-grid';
  for(const role of WEBHOOK_MAPPING_ROLES){
    const field=document.createElement('div');field.className='mapper-field';
    const label=document.createElement('label');label.htmlFor=`mapper-${role.key}-${connection.id}`;label.textContent=role.label;
    const hint=document.createElement('span');hint.className=role.required?'required':'optional';hint.textContent=role.hint;label.appendChild(hint);
    const input=document.createElement('input');input.id=`mapper-${role.key}-${connection.id}`;input.type='text';input.placeholder=role.required?'/customer/phone':'미지정';input.setAttribute('list',datalist.id);input.autocomplete='off';
    const preview=document.createElement('small');preview.className='mapper-value-preview';preview.textContent='미지정';
    input.addEventListener('input',()=>updateMapperFieldPreviews(state));
    state.inputs[role.key]=input;state.previews[role.key]=preview;
    field.append(label,input,preview);grid.appendChild(field);
  }

  const helperActions=document.createElement('div');helperActions.className='mapper-actions';
  const suggest=document.createElement('button');suggest.type='button';suggest.className='row-action';suggest.textContent='자동 추천 적용';suggest.onclick=()=>applyMapperSuggestion(state);
  const save=document.createElement('button');save.type='button';save.className='row-action primary-small';save.textContent='매핑 저장';save.onclick=()=>saveWebhookMapping(state,save);
  const replay=document.createElement('button');replay.type='button';replay.className='row-action';replay.textContent='선택 샘플 재처리';replay.onclick=()=>replayWebhookSample(state,replay);state.replayButton=replay;
  helperActions.append(suggest,save,replay);

  const sampleMeta=document.createElement('div');sampleMeta.className='mapper-sample-meta';state.sampleMeta=sampleMeta;
  const payload=document.createElement('pre');payload.className='mapper-payload';state.payload=payload;
  const noticeBox=document.createElement('div');noticeBox.className='mapper-notice';noticeBox.dataset.mapperNotice='1';
  const privacy=document.createElement('p');privacy.className='mapper-privacy';privacy.textContent='샘플 원문은 현재 화면에서만 확인하며 브라우저 저장소에 저장하지 않습니다. 서버 원문 보관기간이 지나면 자동 삭제됩니다.';

  panel.append(head,sampleBar,datalist,grid,helperActions,noticeBox,sampleMeta,payload,privacy);
  populateMapperDatalist(state,selectedMapperSample(state));
  hydrateMapperInputs(state);
  renderMapperPayload(state);
  sampleSelect.onchange=()=>{
    populateMapperDatalist(state,selectedMapperSample(state));
    updateMapperFieldPreviews(state);
    renderMapperPayload(state);
    clearMapperNotice(panel);
  };
  document.dispatchEvent(new CustomEvent('calltag:connect-ui-updated',{detail:{area:'mapper'}}));
}

async function refreshWebhookMapper(state,button=null){
  if(button){button.disabled=true;button.textContent='불러오는 중...'}
  try{
    const data=await api(`/api/calltag/v1/connections/${encodeURIComponent(state.connection.id)}/samples?limit=5`);
    renderWebhookMapperPanel(state.panel,data,state.card);
  }catch(error){
    if(error.status===401||error.status===403){requireLogin();return}
    mapperNotice(state.panel,error.message,'error');
  }finally{if(button){button.disabled=false;button.textContent='샘플 새로고침'}}
}

async function openWebhookMapper(connectionId,card,button){
  const existing=card.querySelector('[data-webhook-mapper-panel]');
  if(existing){existing.remove();button.textContent='매핑 설정';return}
  document.querySelectorAll('[data-webhook-mapper-panel]').forEach((panel)=>panel.remove());
  button.disabled=true;const original=button.textContent;button.textContent='불러오는 중...';
  const panel=document.createElement('div');panel.className='mapper-panel';panel.dataset.webhookMapperPanel='1';card.appendChild(panel);
  const loading=document.createElement('div');loading.className='mapper-loading';loading.textContent='최근 Webhook 샘플을 불러오는 중입니다.';panel.appendChild(loading);
  try{
    const data=await api(`/api/calltag/v1/connections/${encodeURIComponent(connectionId)}/samples?limit=5`);
    renderWebhookMapperPanel(panel,data,card);
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){
    if(error.status===401||error.status===403){panel.remove();requireLogin();return}
    panel.textContent='';
    const fail=document.createElement('div');fail.className='mapper-notice show error';fail.textContent=error.message;panel.appendChild(fail);
    document.dispatchEvent(new CustomEvent('calltag:connect-ui-updated',{detail:{area:'mapper-error'}}));
  }finally{button.disabled=false;button.textContent=original}
}

const webhookMapperRoot=$('webhookList');
if(webhookMapperRoot){
  webhookMapperRoot.addEventListener('calltag:webhooks-rendered',decorateWebhookMapperCards);
  decorateWebhookMapperCards();
}
