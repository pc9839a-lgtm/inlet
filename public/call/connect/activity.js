let activityLoaded=false;
let activityLoading=false;

const ACTIVITY_ENDPOINT='/api/calltag/v1/activity';
const ACTIVITY_SOURCE_LABELS={
  pagero:'PageRo',
  meta_lead_ads:'Meta Lead Ads',
  custom_webhook:'Generic Webhook',
  direct_api:'Direct API',
  calltag_e2e_test:'CallTag E2E Test',
};
const ACTIVITY_ACTION_LABELS={
  'lead.push':'Direct API 앱 신호',
  'webhook.push':'Webhook 앱 신호',
  'meta.lead.process':'Meta 리드 처리',
  'lead.intake':'Direct API 접수',
  'webhook.receive':'Webhook 수신',
};

function activityStageMeta(event={}){
  if(event.stage==='PAGERO_LEGACY')return {label:'PageRo 기존 경로',className:'neutral',detail:'PageRo 문의는 기존 전용 전달 경로에서 처리됩니다.'};
  if(event.stage==='IMPORTED')return {label:'가져오기 완료',className:'good',detail:'콜태그 앱이 문의를 가져오고 ACK까지 완료했습니다.'};
  if(event.stage==='REJECTED')return {label:'가져오기 거절',className:'bad',detail:event.result||'앱에서 문의 가져오기를 거절했습니다.'};
  if(event.stage==='APP_FETCHED')return {label:'앱 가져감',className:activityIsStale(event.deliveredAt||event.updatedAt)?'warn':'active',detail:activityIsStale(event.deliveredAt||event.updatedAt)?'앱이 문의를 가져갔지만 ACK가 오래 지연되고 있습니다.':'앱이 문의를 가져갔고 ACK를 기다리는 중입니다.'};
  return {label:'서버 수신',className:activityIsStale(event.createdAt||event.updatedAt)?'warn':'active',detail:activityIsStale(event.createdAt||event.updatedAt)?'서버에는 수신됐지만 앱이 아직 가져가지 않았습니다.':'서버에 수신됐고 앱 가져오기를 기다리는 중입니다.'};
}

function activityIsStale(value=''){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return false;
  return Date.now()-date.getTime()>10*60*1000;
}

function activitySourceLabel(type='',name=''){
  return name||ACTIVITY_SOURCE_LABELS[type]||type||'외부 문의';
}

function activityText(value=''){return String(value||'')}

function activityClear(){
  $('activityList').textContent='';
  const failures=$('activityFailureList');if(failures)failures.textContent='';
  clearNotice($('activityNotice'));
}

function activitySetSummary(summary={}){
  $('activityTotal').textContent=String(Number(summary.total||0));
  $('activityAccepted').textContent=String(Number(summary.accepted||0));
  $('activityDelivered').textContent=String(Number(summary.delivered||0));
  $('activityImported').textContent=String(Number(summary.imported||0));
  $('activityRejected').textContent=String(Number(summary.rejected||0));
}

function activityRenderSources(sources=[]){
  const select=$('activitySource');
  const current=select.value;
  select.textContent='';
  const all=document.createElement('option');all.value='';all.textContent='전체 소스';select.appendChild(all);
  for(const item of sources){
    const option=document.createElement('option');
    option.value=activityText(item.type);
    option.textContent=`${activitySourceLabel(activityText(item.type))} · ${Number(item.count||0)}건`;
    select.appendChild(option);
  }
  if([...select.options].some((option)=>option.value===current))select.value=current;
}

function activityEnsureFailureSection(){
  let root=$('activityFailureList');
  if(root)return root;
  const activity=$('activityDetail');
  const eventList=$('activityList');
  if(!activity||!eventList)return null;

  const section=document.createElement('div');section.className='activity-failure-section';
  const head=document.createElement('div');head.className='connection-top';
  const main=document.createElement('div');main.className='row-main';
  const title=document.createElement('strong');title.textContent='최근 실패';
  const description=document.createElement('span');description.textContent='최근 7일 운영 실패 코드만 표시하며 고객 개인정보는 포함하지 않습니다.';
  main.append(title,description);
  const count=document.createElement('span');count.id='activityFailureCount';count.className='status';count.textContent='0건';
  head.append(main,count);
  root=document.createElement('div');root.id='activityFailureList';root.className='list';
  section.append(head,root);
  activity.insertBefore(section,eventList);
  return root;
}

function activityRenderFailures(failures=[]){
  const root=activityEnsureFailureSection();
  if(!root)return;
  root.textContent='';
  const count=$('activityFailureCount');if(count)count.textContent=`${failures.length}건`;
  if(!failures.length){
    const empty=document.createElement('div');empty.className='empty';empty.textContent='최근 7일 운영 실패 기록이 없습니다.';root.appendChild(empty);return;
  }
  for(const failure of failures){
    const card=document.createElement('article');card.className='activity-card';
    const top=document.createElement('div');top.className='connection-top';
    const main=document.createElement('div');main.className='row-main';
    const source=document.createElement('strong');source.textContent=activitySourceLabel(failure.sourceType);
    const action=document.createElement('span');action.textContent=ACTIVITY_ACTION_LABELS[failure.action]||failure.action||'연동 처리';
    main.append(source,action);
    const badge=document.createElement('span');badge.className='health-badge bad';badge.textContent=failure.code||'FAILED';
    top.append(main,badge);

    const details=document.createElement('div');details.className='activity-meta';
    const rows=[
      ['발생',activityFormatTime(failure.createdAt)],
      ['HTTP',failure.statusCode?String(failure.statusCode):'확인 필요'],
      ['이벤트',failure.eventId||'없음'],
    ];
    for(const [label,value] of rows){
      const box=document.createElement('div');const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;box.append(b,span);details.appendChild(box);
    }
    card.append(top,details);
    root.appendChild(card);
  }
}

function activityTimeline(event={}){
  const wrap=document.createElement('div');wrap.className='activity-timeline';
  if(event.deliveryMode==='pagero_legacy'){
    const chip=document.createElement('span');chip.className='activity-step legacy';chip.textContent='PageRo 기존 경로';wrap.appendChild(chip);return wrap;
  }
  const ordered=[
    ['RECEIVED','서버 수신'],
    ['APP_FETCHED','앱 가져감'],
    ['IMPORTED','ACK 완료'],
  ];
  const rank={RECEIVED:1,APP_FETCHED:2,IMPORTED:3,REJECTED:2};
  const currentRank=rank[event.stage]||1;
  for(let index=0;index<ordered.length;index++){
    const [stage,label]=ordered[index];
    const chip=document.createElement('span');
    chip.className=`activity-step ${index+1<=currentRank?'done':''}`;
    chip.textContent=label;
    wrap.appendChild(chip);
  }
  if(event.stage==='REJECTED'){
    const rejected=document.createElement('span');rejected.className='activity-step rejected';rejected.textContent='거절';wrap.appendChild(rejected);
  }
  return wrap;
}

function activityRenderEvents(events=[]){
  const root=$('activityList');root.textContent='';
  if(!events.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='조건에 맞는 외부 문의 활동이 없습니다.';root.appendChild(empty);return}
  for(const event of events){
    const card=document.createElement('article');card.className='activity-card';
    const top=document.createElement('div');top.className='connection-top';
    const main=document.createElement('div');main.className='row-main';
    const source=document.createElement('strong');source.textContent=activitySourceLabel(event.source?.type,event.source?.name);
    const identity=document.createElement('span');
    const customer=[event.customer?.name,event.customer?.phoneMasked].filter(Boolean).join(' · ');
    identity.textContent=customer||`Event ${event.id||''}`;
    main.append(source,identity);
    const meta=activityStageMeta(event);
    const badge=document.createElement('span');badge.className=`health-badge ${meta.className}`;badge.textContent=meta.label;
    top.append(main,badge);

    card.append(top,activityTimeline(event));

    if(event.inquiryPreview){const preview=document.createElement('p');preview.className='activity-preview';preview.textContent=event.inquiryPreview;card.appendChild(preview)}

    const details=document.createElement('div');details.className='activity-meta';
    const rows=[
      ['접수',activityFormatTime(event.createdAt||event.submittedAt)],
      ['앱 전달',event.deliveryMode==='pagero_legacy'?'기존 경로':activityFormatTime(event.deliveredAt)],
      ['ACK',event.deliveryMode==='pagero_legacy'?'기존 경로':activityFormatTime(event.importedAt)],
      ['이벤트',event.eventId||String(event.id||'')],
    ];
    for(const [label,value] of rows){
      const box=document.createElement('div');const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;box.append(b,span);details.appendChild(box);
    }
    card.appendChild(details);

    const message=document.createElement('div');message.className=`health-message show ${meta.className==='bad'?'bad':meta.className==='warn'?'warn':meta.className==='good'?'good':''}`;message.textContent=meta.detail;card.appendChild(message);
    root.appendChild(card);
  }
}

function activityFormatTime(value){
  if(!value)return '아직 없음';
  if(typeof value==='number'&&value>0){const ms=value>1e12?value:value*1000;const date=new Date(ms);return Number.isNaN(date.getTime())?'확인 필요':date.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
  return formatTime(value);
}

async function loadActivity(force=false){
  if(activityLoading)return;
  if(activityLoaded&&!force)return;
  activityLoading=true;
  const button=$('refreshActivity');if(button){button.disabled=true;button.textContent='확인 중...'}
  clearNotice($('activityNotice'));
  try{
    const params=new URLSearchParams({limit:'50'});
    if($('activitySource').value)params.set('sourceType',$('activitySource').value);
    if($('activityStatus').value)params.set('status',$('activityStatus').value);
    const data=await api(`${ACTIVITY_ENDPOINT}?${params.toString()}`);
    if(data.readOnly!==true)throw new Error('활동 조회 안전 상태를 확인하지 못했습니다.');
    activitySetSummary(data.summary||{});
    activityRenderSources(data.sources||[]);
    activityRenderFailures(data.failures||[]);
    activityRenderEvents(data.events||[]);
    activityLoaded=true;
    $('activityReadOnly').textContent=data.summaryExcludesTest===true?'읽기 전용 · 테스트 제외':'읽기 전용';
    $('activityReadOnly').className='status on';
    document.dispatchEvent(new CustomEvent('calltag:connect-ui-updated',{detail:{area:'activity'}}));
  }catch(error){
    if(error.status===401||error.status===403){requireLogin();return}
    $('activityReadOnly').textContent='확인 실패';$('activityReadOnly').className='status bad';
    notice($('activityNotice'),error.message,'error');
  }finally{
    activityLoading=false;
    if(button){button.disabled=false;button.textContent='새로고침'}
  }
}

const activityTab=document.querySelector('[data-section="activityDetail"]');
if(activityTab)activityTab.addEventListener('click',()=>loadActivity());
$('refreshActivity').onclick=()=>loadActivity(true);
$('activitySource').onchange=()=>{activityLoaded=false;loadActivity(true)};
$('activityStatus').onchange=()=>{activityLoaded=false;loadActivity(true)};