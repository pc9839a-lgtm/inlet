(()=>{
  const root=document.getElementById('apiGuide');
  if(!root)return;

  const endpoint=`${location.origin}/api/calltag/v1/leads`;
  const payload={
    event_id:'crm_20260825_0001',
    source:{type:'direct_api',name:'사내 CRM',provider:'custom'},
    customer:{name:'홍길동',phone:'01012345678',email:'hong@example.com'},
    inquiry:{
      content:'상담 요청',
      fields:[
        {key:'product',label:'관심 상품',value:'간병보험',order:1},
        {key:'preferred_time',label:'희망 연락시간',value:'오후 3시',order:2},
      ],
    },
    submitted_at:'2026-08-25T12:30:00+09:00',
    metadata:{campaign:'summer_2026'},
  };
  const payloadText=JSON.stringify(payload,null,2);
  const curl=[
    `curl -X POST '${endpoint}' \\`,
    `  -H 'Authorization: Bearer <YOUR_API_KEY>' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Idempotency-Key: crm-20260825-0001' \\`,
    `  --data '${payloadText.replace(/'/g,"'\\''")}'`,
  ].join('\n');
  const createdResponse=JSON.stringify({ok:true,eventId:'crm_20260825_0001',customerId:'ctcust_xxxxx',result:'CREATED'},null,2);
  const duplicateResponse=JSON.stringify({ok:true,eventId:'crm_20260825_0001',customerId:'ctcust_xxxxx',result:'DUPLICATE_IGNORED'},null,2);

  function el(tag,className,text=''){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text)node.textContent=text;
    return node;
  }

  function copyButton(value,label='복사'){
    const button=el('button','api-guide-copy',label);
    button.type='button';
    button.addEventListener('click',async()=>{
      const original=button.textContent;
      try{
        if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
        else{
          const area=document.createElement('textarea');
          area.value=value;
          area.style.position='fixed';
          area.style.opacity='0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        button.textContent='복사됨';
      }catch{button.textContent='복사 실패'}
      setTimeout(()=>{button.textContent=original},1400);
    });
    return button;
  }

  function codeBlock(title,value){
    const wrap=el('section','api-guide-block');
    const head=el('div','api-guide-block-head');
    head.append(el('strong','',title),copyButton(value));
    const pre=el('pre','api-guide-code');
    const code=el('code','',value);
    pre.appendChild(code);
    wrap.append(head,pre);
    return wrap;
  }

  function infoRow(label,value){
    const row=el('div','api-guide-info-row');
    row.append(el('b','',label),el('span','',value));
    return row;
  }

  const details=el('details','api-guide-shell');
  const summary=el('summary','api-guide-summary');
  const summaryMain=el('span','api-guide-summary-main');
  summaryMain.append(el('strong','','Direct API 연동 가이드'),el('span','','인증 · 멱등성 · JSON 예제 · 응답 · 오류코드'));
  summary.append(summaryMain,el('span','api-guide-summary-action','열기'));
  details.appendChild(summary);

  const body=el('div','api-guide-body');
  const warning=el('div','api-guide-warning');
  warning.append(
    el('strong','','서버에서만 호출하세요.'),
    el('p','','API Key를 웹페이지 JavaScript, 모바일 앱 소스, 공개 저장소에 넣지 마세요. Key는 외부 서버의 secret으로 보관합니다.'),
  );
  body.appendChild(warning);

  const basics=el('div','api-guide-info');
  basics.append(
    infoRow('Endpoint',endpoint),
    infoRow('Method','POST'),
    infoRow('Authorization','Authorization: Bearer <YOUR_API_KEY>'),
    infoRow('Content-Type','application/json'),
    infoRow('중복 방지','Idempotency-Key 또는 event_id / external_id 중 하나 필수'),
  );
  const endpointActions=el('div','api-guide-inline-actions');
  endpointActions.append(copyButton(endpoint,'Endpoint 복사'),copyButton('Authorization: Bearer <YOUR_API_KEY>','Header 복사'));
  body.append(basics,endpointActions);

  const note=el('div','api-guide-note');
  note.append(
    el('b','','중복/재문의 처리'),
    el('p','','같은 event_id·external_id·Idempotency-Key는 중복 문의로 무시됩니다. 같은 전화번호라도 새로운 event_id로 보내면 기존 고객에 새 문의 이력이 추가됩니다.'),
  );
  body.appendChild(note);

  body.append(codeBlock('cURL 예제',curl));
  body.append(codeBlock('JSON body 예제',payloadText));

  const responseGrid=el('div','api-guide-response-grid');
  responseGrid.append(codeBlock('201 · 신규 문의',createdResponse),codeBlock('200 · 중복 무시',duplicateResponse));
  body.appendChild(responseGrid);

  const errors=el('section','api-guide-errors');
  errors.appendChild(el('strong','','자주 보는 오류'));
  const rows=[
    ['401 · CALLTAG_API_KEY_REQUIRED','Authorization Bearer API Key가 없습니다.'],
    ['401 · CALLTAG_API_KEY_INVALID','키가 잘못됐거나 이미 폐기됐습니다.'],
    ['400 · CALLTAG_LEAD_IDEMPOTENCY_REQUIRED','Idempotency-Key 또는 event_id/external_id가 없습니다.'],
    ['400 · CALLTAG_LEAD_PHONE_REQUIRED','유효한 고객 전화번호가 필요합니다.'],
    ['400 · CALLTAG_LEAD_EMAIL_INVALID','이메일 형식이 올바르지 않습니다.'],
    ['400 · CALLTAG_LEAD_JSON_INVALID','JSON 형식이 올바르지 않습니다.'],
    ['413 · CALLTAG_LEAD_BODY_TOO_LARGE','요청 body가 256KB 제한을 초과했습니다.'],
  ];
  for(const [code,message] of rows){
    const row=el('div','api-guide-error-row');
    row.append(el('code','',code),el('span','',message));
    errors.appendChild(row);
  }
  body.appendChild(errors);

  const resultNote=el('div','api-guide-result-note');
  resultNote.append(
    el('b','','성공 result'),
    el('span','','CREATED · MATCHED_EXISTING · DUPLICATE_IGNORED'),
  );
  body.appendChild(resultNote);

  details.appendChild(body);
  root.textContent='';
  root.appendChild(details);
})();