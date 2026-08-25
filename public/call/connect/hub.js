const $=(id)=>document.getElementById(id);
let session=localStorage.getItem(SESSION_KEY)||'';
let oauthSessionId='';
let metaConnections=[];
let webhookConnections=[];
let apiKeys=[];
try{oauthSessionId=sessionStorage.getItem(OAUTH_SESSION_KEY)||''}catch{}

function notice(el,message,type='ok'){el.textContent=message;el.className=`notice show ${type}`}
function clearNotice(el){el.textContent='';el.className='notice'}
function authHeaders(json=false){return {...(json?{'Content-Type':'application/json'}:{}),...(session?{'X-Inlet-Session':session}:{})}}
function setAuthed(value){
  $('loginPanel').classList.toggle('hidden',value);
  document.querySelectorAll('[data-auth-only]').forEach((el)=>el.classList.toggle('hidden',!value));
  $('logout').classList.toggle('hidden',!value);
  if(value){resetMetaStartButton();showDetail('metaDetail',false)}
}
function requireLogin(){session='';localStorage.removeItem(SESSION_KEY);resetMetaStartButton();setAuthed(false)}
function rememberOauthSession(id=''){oauthSessionId=id;try{if(id)sessionStorage.setItem(OAUTH_SESSION_KEY,id);else sessionStorage.removeItem(OAUTH_SESSION_KEY)}catch{}}
function formatTime(value){if(!value)return '아직 없음';const date=new Date(value);return Number.isNaN(date.getTime())?'확인 필요':date.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function healthLabel(state){return state==='healthy'?'정상':state==='active'?'연결됨':state==='warning'?'확인 필요':state==='error'?'연결 오류':state==='revoked'?'해제됨':'확인 전'}
function healthClass(state){return state==='healthy'?'good':state==='warning'?'warn':state==='error'||state==='revoked'?'bad':''}
function reasonLabel(code){const labels={CALLTAG_META_TOKEN_EXPIRED:'Meta 인증이 만료되었습니다. 다시 연결해주세요.',CALLTAG_META_PAGE_ACCESS_DENIED:'Meta 페이지 접근 권한을 확인할 수 없습니다. 다시 연결해주세요.',CALLTAG_META_PAGE_CREDENTIAL_INVALID:'Meta 페이지 인증정보를 확인할 수 없습니다. 다시 연결해주세요.',CALLTAG_META_CREDENTIAL_MISSING:'저장된 Meta 인증정보가 없습니다. 다시 연결해주세요.',CALLTAG_META_SCOPE_MISSING:'필수 Meta 권한 일부가 부족합니다. 다시 연결해주세요.',CALLTAG_META_CONNECTION_ERROR:'최근 문의 처리 중 오류가 있었습니다.',CALLTAG_META_LAST_ERROR:'최근 Meta 문의 처리 오류가 기록되어 있습니다.',CALLTAG_META_HEALTH_CHECK_FAILED:'Meta 연결 상태를 확인하지 못했습니다.'};return labels[code]||''}
function setStatus(el,count,label='연결'){el.textContent=count?`${count}개 ${label}`:'미연결';el.classList.toggle('on',count>0)}
function activeOnly(items=[]){return items.filter((item)=>item.status!=='revoked')}
function emitWebhooksRendered(root,count){root.dispatchEvent(new CustomEvent('calltag:webhooks-rendered',{detail:{count}}))}

async function api(url,{method='GET',body}={}){
  const response=await fetch(url,{method,headers:authHeaders(body!==undefined),...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false){const error=new Error(data.error||'요청을 처리하지 못했습니다.');error.code=data.details?.code||data.code||'';error.status=response.status;throw error}
  return data;
}

function showDetail(id,scroll=true){
  document.querySelectorAll('[data-detail]').forEach((el)=>el.classList.toggle('hidden',el.id!==id));
  document.querySelectorAll('[data-section]').forEach((button)=>button.classList.toggle('active',button.dataset.section===id));
  if(scroll)$(id)?.scrollIntoView({behavior:'smooth',block:'start'});
}
document.querySelectorAll('[data-section]').forEach((button)=>button.onclick=()=>showDetail(button.dataset.section));
$('openMeta').onclick=()=>showDetail('metaDetail');
$('openWebhook').onclick=()=>showDetail('webhookDetail');
$('openApi').onclick=()=>showDetail('apiDetail');

function updateSummary(){
  const meta=activeOnly(metaConnections).length;
  const webhooks=activeOnly(webhookConnections).length;
  const keys=activeOnly(apiKeys).length;
  const channels=1+(meta?1:0)+(webhooks?1:0)+(keys?1:0);
  $('summaryChannels').textContent=String(channels);
  $('summaryMeta').textContent=String(meta);
  $('summaryWebhook').textContent=String(webhooks);
  $('summaryApi').textContent=String(keys);
  $('hubState').textContent=(meta+webhooks+keys)?'연동 사용 중':'PageRo 기본';
  setStatus($('webhookStatus'),webhooks);
  setStatus($('apiStatus'),keys);
  $('webhookDetailStatus').textContent=`${webhooks}개 활성`;
  $('apiDetailStatus').textContent=`${keys}개 활성`;
}

function passiveState(item){if(item.status==='error'||item.lastError)return 'warning';if(item.status==='active')return 'active';return 'unknown'}
function healthItem(label,value,attr=''){
  const box=document.createElement('div');box.className='health-item';
  const b=document.createElement('b');b.textContent=label;
  const span=document.createElement('span');span.textContent=value;if(attr)span.dataset[attr]='1';
  box.append(b,span);return box;
}

function renderConnections(items=[]){
  metaConnections=items;
  const root=$('connectionList');root.textContent='';
  const active=activeOnly(items);
  const hasWarning=active.some((item)=>item.status==='error'||item.lastError);
  $('metaStatus').textContent=!active.length?'미연결':hasWarning?'확인 필요':`${active.length}개 연결`;
  $('metaStatus').classList.toggle('on',active.length>0&&!hasWarning);
  $('metaStatus').classList.toggle('warn',hasWarning);
  if(!active.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='연결된 Meta 페이지가 없습니다.';root.appendChild(empty);updateSummary();return}
  for(const item of active){
    const card=document.createElement('div');card.className='connection-card';card.dataset.connectionId=item.id||'';
    const top=document.createElement('div');top.className='connection-top';
    const main=document.createElement('div');main.className='row-main';
    const name=document.createElement('strong');name.textContent=item.pageName||'Meta 페이지';
    const sub=document.createElement('span');sub.textContent=`Page ${item.pageId||''}`;
    main.append(name,sub);
    const badge=document.createElement('span');const state=passiveState(item);badge.className=`health-badge ${healthClass(state)}`;badge.dataset.healthBadge='1';badge.textContent=healthLabel(state);
    top.append(main,badge);
    const grid=document.createElement('div');grid.className='health-grid';
    grid.append(
      healthItem('최근 문의',formatTime(item.lastLeadAt),'lastLead'),
      healthItem('최근 Webhook',formatTime(item.lastWebhookAt),'lastWebhook'),
      healthItem('Meta 인증 만료',item.tokenExpiresAt?formatTime(item.tokenExpiresAt):'만료일 미제공','tokenExpiry'),
      healthItem('권한 상태',Array.isArray(item.grantedScopes)&&item.grantedScopes.length?`${item.grantedScopes.length}개 저장됨`:'확인 전','scopeStatus'),
    );
    const message=document.createElement('div');message.className=`health-message ${item.lastError?'show warn':''}`;message.dataset.healthMessage='1';if(item.lastError)message.textContent='최근 Meta 문의 처리 오류가 있습니다. 상태 확인 또는 재연결을 진행해주세요.';
    const actions=document.createElement('div');actions.className='row-actions';
    const check=document.createElement('button');check.className='row-action primary-small';check.type='button';check.textContent='상태 확인';check.onclick=()=>checkConnectionHealth(item.id,card,check);
    const reconnect=document.createElement('button');reconnect.className='row-action';reconnect.type='button';reconnect.textContent='재연결';reconnect.onclick=()=>startMetaConnect(reconnect);
    const revoke=document.createElement('button');revoke.className='row-action danger';revoke.type='button';revoke.textContent='연결 해제';revoke.onclick=()=>revokeConnection(item.id,revoke);
    actions.append(check,reconnect,revoke);
    card.append(top,grid,message,actions);root.appendChild(card);
  }
  updateSummary();
}

function applyHealth(card,health={}){
  const badge=card.querySelector('[data-health-badge]');if(badge){badge.className=`health-badge ${healthClass(health.state)}`;badge.textContent=healthLabel(health.state)}
  const scope=card.querySelector('[data-scope-status]');if(scope){if(health.scopes?.known)scope.textContent=health.scopes.missing?.length?`${health.scopes.missing.length}개 권한 부족`:'필수 권한 정상';else scope.textContent='권한 정보 없음'}
  const expiry=card.querySelector('[data-token-expiry]');if(expiry)expiry.textContent=health.token?.expiresAt?formatTime(health.token.expiresAt):'만료일 미제공';
  const lead=card.querySelector('[data-last-lead]');if(lead)lead.textContent=formatTime(health.activity?.lastLeadAt);
  const webhook=card.querySelector('[data-last-webhook]');if(webhook)webhook.textContent=formatTime(health.activity?.lastWebhookAt);
  const message=card.querySelector('[data-health-message]');if(message){const reason=(health.reasons||[]).map(reasonLabel).find(Boolean);const fallback=health.pageAccess===true?'Meta 페이지 접근 권한을 정상 확인했습니다.':'Meta 연결 상태를 확인했습니다.';message.textContent=reason||fallback;message.className=`health-message show ${health.state==='healthy'?'good':health.state==='error'?'bad':'warn'}`}
}

async function checkConnectionHealth(id,card,button){
  button.disabled=true;const original=button.textContent;button.textContent='확인 중...';
  try{const data=await api('/api/calltag/v1/meta/health',{method:'POST',body:{connectionId:id}});applyHealth(card,data.health||{})}
  catch(error){if(error.status===401||error.status===403){requireLogin();return}const box=card.querySelector('[data-health-message]');if(box){box.textContent=error.message;box.className='health-message show bad'}}
  finally{button.disabled=false;button.textContent=original}
}

async function loadMetaConnections(){
  const data=await api('/api/calltag/v1/meta/connections');
  renderConnections(data.connections||[]);
}

async function revokeConnection(id,button){
  if(!confirm('이 Meta 페이지 연결을 해제할까요?'))return;
  button.disabled=true;
  try{await api('/api/calltag/v1/meta/connections',{method:'PATCH',body:{action:'revoke',connectionId:id}});await loadMetaConnections();notice($('metaNotice'),'연결을 해제했습니다.')}
  catch(error){notice($('metaNotice'),error.message,'error')}
  finally{button.disabled=false}
}

function renderWebhooks(items=[]){
  webhookConnections=items;
  const root=$('webhookList');root.textContent='';
  const active=activeOnly(items);
  if(!active.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='만든 Webhook 연결이 없습니다.';root.appendChild(empty);updateSummary();emitWebhooksRendered(root,0);return}
  for(const item of active){
    const card=document.createElement('div');card.className='connection-card';card.dataset.webhookConnectionId=String(item.id||'');
    const top=document.createElement('div');top.className='connection-top';
    const main=document.createElement('div');main.className='row-main';
    const name=document.createElement('strong');name.textContent=item.name||'Webhook';
    const sub=document.createElement('span');sub.textContent=item.sourceName||'외부 서비스';
    main.append(name,sub);
    const badge=document.createElement('span');badge.className=`health-badge ${item.lastError?'warn':item.mappingReady?'good':''}`;badge.textContent=item.lastError?'확인 필요':item.mappingReady?'수집 준비':'매핑 필요';
    top.append(main,badge);
    const meta=document.createElement('div');meta.className='item-meta';
    const rows=[['최근 수신',formatTime(item.lastReceivedAt)],['수신 샘플',`${Number(item.sampleCount||0)}건`],['필드 매핑',item.mappingReady?`v${item.mappingVersion||1} 적용`:'설정 필요'],['원문 보관',`${Number(item.rawRetentionDays||7)}일`]];
    for(const [label,value] of rows){const box=document.createElement('div');const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;box.append(b,span);meta.appendChild(box)}
    const message=document.createElement('div');if(item.lastError){message.className='health-message show warn';message.textContent='최근 Webhook 처리 오류가 있습니다. 필드 매핑 또는 원문 샘플을 확인해주세요.'}
    const actions=document.createElement('div');actions.className='row-actions';
    const rotate=document.createElement('button');rotate.className='row-action primary-small';rotate.type='button';rotate.textContent='URL 교체';rotate.onclick=()=>rotateWebhook(item.id,rotate);
    const info=document.createElement('button');info.className='row-action';info.type='button';info.dataset.webhookMapperTrigger='1';info.textContent=item.mappingReady?'매핑 완료':'매핑 필요';info.disabled=true;
    const revoke=document.createElement('button');revoke.className='row-action danger';revoke.type='button';revoke.textContent='연결 해제';revoke.onclick=()=>revokeWebhook(item.id,revoke);
    actions.append(rotate,info,revoke);card.append(top,meta);if(item.lastError)card.append(message);card.append(actions);root.appendChild(card);
  }
  updateSummary();
  emitWebhooksRendered(root,active.length);
}

async function loadWebhooks(){const data=await api('/api/calltag/v1/connections');renderWebhooks(data.connections||[])}

function showSecret(el,title,value,note){
  el.textContent='';el.className='secret-box show';
  const b=document.createElement('b');b.textContent=title;
  const line=document.createElement('div');line.className='secret-line';
  const secret=document.createElement('div');secret.className='secret-value';secret.textContent=value;
  const copy=document.createElement('button');copy.className='copy-button';copy.type='button';copy.textContent='복사';copy.onclick=()=>copyText(value,copy);
  const p=document.createElement('p');p.className='secret-note';p.textContent=note;
  line.append(secret,copy);el.append(b,line,p);
}

async function copyText(value,button){
  const original=button.textContent;
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
    else{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}
    button.textContent='복사됨';
  }catch{button.textContent='복사 실패'}
  setTimeout(()=>{button.textContent=original},1400);
}

$('toggleWebhookCreate').onclick=()=>{$('webhookCreateForm').classList.toggle('hidden');$('webhookName').focus()};
$('webhookCreateForm').onsubmit=async(event)=>{
  event.preventDefault();clearNotice($('webhookNotice'));
  const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
  try{
    const data=await api('/api/calltag/v1/connections',{method:'POST',body:{name:$('webhookName').value,sourceName:$('webhookSource').value||$('webhookName').value,rawRetentionDays:Number($('webhookRetention').value||7)}});
    if(!data.endpointUrl)throw new Error('Webhook URL을 만들지 못했습니다.');
    showSecret($('webhookSecret'),'Webhook URL — 지금 한 번만 저장하세요',data.endpointUrl,'이 URL에는 비밀 엔드포인트 키가 포함됩니다. 브라우저 저장소에는 보관하지 않습니다.');
    event.currentTarget.reset();$('webhookRetention').value='7';$('webhookCreateForm').classList.add('hidden');
    await loadWebhooks();notice($('webhookNotice'),'Webhook 연결을 만들었습니다. 첫 샘플 수신 후 필드 매핑이 필요합니다.');
  }catch(error){if(error.status===401||error.status===403){requireLogin();return}notice($('webhookNotice'),error.message,'error')}
  finally{button.disabled=false}
};

async function rotateWebhook(id,button){
  if(!confirm('Webhook URL을 교체하면 이전 URL은 즉시 사용할 수 없게 됩니다. 교체할까요?'))return;
  button.disabled=true;
  try{
    const data=await api('/api/calltag/v1/connections',{method:'PATCH',body:{action:'rotate_endpoint',connectionId:id}});
    if(data.endpointUrl)showSecret($('webhookSecret'),'새 Webhook URL — 지금 한 번만 저장하세요',data.endpointUrl,'기존 URL은 폐기되었습니다. 새 URL은 브라우저 저장소에 보관하지 않습니다.');
    await loadWebhooks();
  }catch(error){notice($('webhookNotice'),error.message,'error')}
  finally{button.disabled=false}
}

async function revokeWebhook(id,button){
  if(!confirm('이 Webhook 연결을 해제할까요?'))return;
  button.disabled=true;
  try{await api('/api/calltag/v1/connections',{method:'PATCH',body:{action:'revoke',connectionId:id}});await loadWebhooks();notice($('webhookNotice'),'Webhook 연결을 해제했습니다.')}
  catch(error){notice($('webhookNotice'),error.message,'error')}
  finally{button.disabled=false}
}

function renderApiKeys(items=[]){
  apiKeys=items;
  const root=$('apiList');root.textContent='';
  const active=activeOnly(items);
  if(!active.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='활성 API Key가 없습니다.';root.appendChild(empty);updateSummary();return}
  for(const item of active){
    const card=document.createElement('div');card.className='connection-card';
    const top=document.createElement('div');top.className='connection-top';
    const main=document.createElement('div');main.className='row-main';
    const name=document.createElement('strong');name.textContent=item.name||'External Lead API';
    const sub=document.createElement('span');sub.textContent=`${item.keyPrefix||'ctk_'}••••`;
    main.append(name,sub);
    const badge=document.createElement('span');badge.className='health-badge good';badge.textContent='활성';
    top.append(main,badge);
    const meta=document.createElement('div');meta.className='item-meta';
    const rows=[['최근 사용',formatTime(item.lastUsedAt)],['생성',formatTime(item.createdAt)],['연결 ID',item.connectionId||'확인 필요'],['요청 경로','POST /api/calltag/v1/leads']];
    for(const [label,value] of rows){const box=document.createElement('div');const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;box.append(b,span);meta.appendChild(box)}
    const actions=document.createElement('div');actions.className='row-actions';
    const rotate=document.createElement('button');rotate.className='row-action primary-small';rotate.type='button';rotate.textContent='키 교체';rotate.onclick=()=>rotateApiKey(item.id,item.name,rotate);
    const endpoint=document.createElement('button');endpoint.className='row-action';endpoint.type='button';endpoint.textContent='API 경로 복사';endpoint.onclick=()=>copyText(`${location.origin}/api/calltag/v1/leads`,endpoint);
    const revoke=document.createElement('button');revoke.className='row-action danger';revoke.type='button';revoke.textContent='키 폐기';revoke.onclick=()=>revokeApiKey(item.id,revoke);
    actions.append(rotate,endpoint,revoke);card.append(top,meta,actions);root.appendChild(card);
  }
  updateSummary();
}

async function loadApiKeys(){const data=await api('/api/calltag/v1/keys');renderApiKeys(data.keys||[])}

$('toggleApiCreate').onclick=()=>{$('apiCreateForm').classList.toggle('hidden');$('apiName').focus()};
$('apiCreateForm').onsubmit=async(event)=>{
  event.preventDefault();clearNotice($('apiNotice'));
  const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
  try{
    const data=await api('/api/calltag/v1/keys',{method:'POST',body:{action:'create',name:$('apiName').value}});
    const key=data.key||{};if(!key.apiKey)throw new Error('API Key를 만들지 못했습니다.');
    showSecret($('apiSecret'),'API Key — 지금 한 번만 저장하세요',key.apiKey,'이 키는 서버에 해시로만 저장되며 다시 조회할 수 없습니다. 브라우저 저장소에도 보관하지 않습니다.');
    event.currentTarget.reset();$('apiCreateForm').classList.add('hidden');
    await loadApiKeys();notice($('apiNotice'),'API Key를 만들었습니다. POST /api/calltag/v1/leads 요청에 Bearer 인증으로 사용하세요.');
  }catch(error){if(error.status===401||error.status===403){requireLogin();return}notice($('apiNotice'),error.message,'error')}
  finally{button.disabled=false}
};

async function rotateApiKey(id,name,button){
  if(!confirm('새 API Key를 만들고 기존 키를 즉시 폐기할까요?'))return;
  button.disabled=true;
  try{
    const data=await api('/api/calltag/v1/keys',{method:'POST',body:{action:'rotate',keyId:id,name}});
    const key=data.key||{};if(key.apiKey)showSecret($('apiSecret'),'새 API Key — 지금 한 번만 저장하세요',key.apiKey,'기존 키는 폐기되었습니다. 새 키는 브라우저 저장소에 보관하지 않습니다.');
    await loadApiKeys();
  }catch(error){notice($('apiNotice'),error.message,'error')}
  finally{button.disabled=false}
}

async function revokeApiKey(id,button){
  if(!confirm('이 API Key를 폐기할까요? 이 키를 쓰는 외부 연동은 즉시 중단됩니다.'))return;
  button.disabled=true;
  try{await api('/api/calltag/v1/keys',{method:'POST',body:{action:'revoke',keyId:id}});await loadApiKeys();notice($('apiNotice'),'API Key를 폐기했습니다.')}
  catch(error){notice($('apiNotice'),error.message,'error')}
  finally{button.disabled=false}
}

async function loadHub(){
  const results=await Promise.allSettled([loadMetaConnections(),loadWebhooks(),loadApiKeys()]);
  const rejected=results.filter((result)=>result.status==='rejected').map((result)=>result.reason);
  const authError=rejected.find((error)=>error?.status===401||error?.status===403);
  if(authError){requireLogin();return false}
  updateSummary();
  if(rejected.length){$('hubState').textContent='일부 확인 필요';$('hubState').className='status warn'}
  else{$('hubState').className='status on'}
  return true;
}

$('loginForm').onsubmit=async(event)=>{
  event.preventDefault();clearNotice($('loginNotice'));
  const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
  try{
    const response=await fetch('/api/call/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,password:$('password').value})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok===false)throw new Error(data.error||'로그인하지 못했습니다.');
    session=data.session||'';if(!session)throw new Error('로그인 세션을 만들지 못했습니다.');
    localStorage.setItem(SESSION_KEY,session);setAuthed(true);resetMetaStartButton();
    const authed=await loadHub();if(authed)await resumeOauthFromUrl();
  }catch(error){notice($('loginNotice'),error.message,'error')}
  finally{button.disabled=false}
};

$('logout').onclick=()=>{localStorage.removeItem(SESSION_KEY);rememberOauthSession('');location.replace('/connect')};

async function startMetaConnect(trigger=$('startMeta')){
  const mainButton=$('startMeta');clearNotice($('metaNotice'));mainButton.disabled=true;mainButton.textContent='Meta 연결 준비 중...';if(trigger!==mainButton)trigger.disabled=true;
  try{
    const data=await api('/api/calltag/v1/meta/oauth/start',{method:'POST',body:{returnPath:'/connect'}});
    if(!data.authorizationUrl)throw new Error('Meta 로그인 주소를 만들지 못했습니다.');
    location.assign(data.authorizationUrl);
  }catch(error){
    resetMetaStartButton();if(trigger!==mainButton)trigger.disabled=false;
    if(error.status===401||error.status===403){requireLogin();return}
    notice($('metaNotice'),error.message,'error');
  }
}
$('startMeta').onclick=()=>startMetaConnect($('startMeta'));

function renderPages(pages=[]){
  const root=$('pageList');root.textContent='';
  if(!pages.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='연결 가능한 Meta 페이지가 없습니다.';root.appendChild(empty);$('completeMeta').disabled=true;return}
  $('completeMeta').disabled=false;
  for(const page of pages){
    const label=document.createElement('label');label.className='page-row';
    const input=document.createElement('input');input.type='checkbox';input.value=page.id;input.checked=true;
    const main=document.createElement('span');main.className='row-main';
    const name=document.createElement('strong');name.textContent=page.name||'Meta 페이지';
    const sub=document.createElement('span');sub.textContent=`Page ${page.id}`;
    main.append(name,sub);label.append(input,main);root.appendChild(label);
  }
}

async function resumeOauthFromUrl(){
  const url=new URL(location.href);const id=url.searchParams.get('metaOAuth')||'';const state=url.searchParams.get('meta')||'';
  if(id)rememberOauthSession(id);
  if(url.searchParams.has('meta')||url.searchParams.has('metaOAuth')||url.searchParams.has('reason')){url.searchParams.delete('meta');url.searchParams.delete('metaOAuth');url.searchParams.delete('reason');replaceConnectHistory(url)}
  if(state==='error'){showDetail('metaDetail',false);notice($('metaNotice'),'Meta 연결을 완료하지 못했습니다. 다시 연결해주세요.','error');return}
  if(!oauthSessionId)return;
  showDetail('metaDetail',false);
  try{
    const data=await api(`/api/calltag/v1/meta/oauth/session?id=${encodeURIComponent(oauthSessionId)}`);const oauth=data.oauth||{};
    if(oauth.status==='authorized'){renderPages(oauth.pages||[]);$('pagePicker').classList.remove('hidden');notice($('metaNotice'),'Meta 로그인이 완료됐습니다. 연결할 페이지를 선택해주세요.')}
    else if(oauth.status==='completed'){rememberOauthSession('');$('pagePicker').classList.add('hidden');notice($('metaNotice'),'Meta 페이지 연결이 완료됐습니다.');await loadMetaConnections()}
    else if(oauth.status==='expired'||oauth.status==='failed'){rememberOauthSession('');$('pagePicker').classList.add('hidden');notice($('metaNotice'),'Meta 연결 시간이 끝났습니다. 다시 연결해주세요.','error')}
  }catch(error){if(error.status===401||error.status===403){requireLogin();return}notice($('metaNotice'),error.message,'error')}
}

$('completeMeta').onclick=async()=>{
  const selected=[...document.querySelectorAll('#pageList input[type=checkbox]:checked')].map((input)=>input.value);
  if(!selected.length){notice($('metaNotice'),'연결할 페이지를 한 개 이상 선택해주세요.','error');return}
  const button=$('completeMeta');button.disabled=true;button.textContent='연결 중...';
  try{
    const data=await api('/api/calltag/v1/meta/oauth/complete',{method:'POST',body:{sessionId:oauthSessionId,pageIds:selected}});
    const failed=(data.results||[]).filter((item)=>!item.ok);
    if(data.completed){rememberOauthSession('');$('pagePicker').classList.add('hidden');notice($('metaNotice'),'선택한 Meta 페이지 연결을 완료했습니다.')}
    else notice($('metaNotice'),failed.length?`${failed.length}개 페이지를 연결하지 못했습니다. 다시 시도해주세요.`:'일부 페이지 연결을 완료하지 못했습니다.','error');
    await loadMetaConnections();
  }catch(error){if(error.status===401||error.status===403){requireLogin();return}notice($('metaNotice'),error.message,'error')}
  finally{button.disabled=false;button.textContent='선택 페이지 연결'}
};

(async()=>{
  if(!session){setAuthed(false);return}
  setAuthed(true);
  const authed=await loadHub();
  if(authed)await resumeOauthFromUrl();
})();
