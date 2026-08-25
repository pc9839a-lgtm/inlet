(()=>{
  const root=document.getElementById('webhookGuide');
  if(!root)return;

  const samplePayload={
    lead:{
      id:'lead_20260825_0001',
      customer:{name:'홍길동',phone:'01012345678',email:'hong@example.com'},
      message:'간병보험 상담 요청',
      submitted_at:'2026-08-25T12:30:00+09:00',
    },
    campaign:{name:'summer_2026'},
  };
  const payloadText=JSON.stringify(samplePayload,null,2);
  const curl=[
    "curl -X POST '<YOUR_WEBHOOK_URL>' \\",
    "  -H 'Content-Type: application/json' \\",
    "  -H 'Idempotency-Key: lead-20260825-0001' \\",
    `  --data '${payloadText.replace(/'/g,"'\\''")}'`,
  ].join('\n');

  function el(tag,className,text=''){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text)node.textContent=text;
    return node;
  }

  function copyButton(value,label='복사'){
    const button=el('button','webhook-guide-copy',label);
    button.type='button';
    button.addEventListener('click',async()=>{
      const original=button.textContent;
      try{
        if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
        else{
          const area=document.createElement('textarea');
          area.value=value;area.style.position='fixed';area.style.opacity='0';
          document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
        }
        button.textContent='복사됨';
      }catch{button.textContent='복사 실패'}
      setTimeout(()=>{button.textContent=original},1400);
    });
    return button;
  }

  function codeBlock(title,value){
    const wrap=el('section','webhook-guide-block');
    const head=el('div','webhook-guide-block-head');
    head.append(el('strong','',title),copyButton(value));
    const pre=el('pre','webhook-guide-code');pre.appendChild(el('code','',value));
    wrap.append(head,pre);return wrap;
  }

  const details=el('details','webhook-guide-shell');
  const summary=el('summary','webhook-guide-summary');
  const summaryMain=el('span','webhook-guide-summary-main');
  summaryMain.append(el('strong','','Webhook 연결 가이드'),el('span','','테스트 JSON 전송 → 필드 매핑 → 샘플 재처리'));
  summary.append(summaryMain,el('span','webhook-guide-summary-action','열기'));
  details.appendChild(summary);

  const body=el('div','webhook-guide-body');
  const secret=el('div','webhook-guide-warning');
  secret.append(
    el('strong','','Webhook URL 자체가 비밀값입니다.'),
    el('p','','생성·교체 직후 한 번 표시되는 URL을 외부 서비스의 서버 설정에만 넣으세요. 공개 웹페이지, 앱 소스, 저장소, 문서에 붙이지 마세요. 유출이 의심되면 URL 교체를 실행하세요.'),
  );
  body.appendChild(secret);

  const steps=el('div','webhook-guide-steps');
  for(const [num,title,desc] of [
    ['1','Webhook 만들기','연결 이름을 정하고 발급된 URL을 즉시 복사합니다.'],
    ['2','테스트 JSON 1건 전송','외부 서비스 또는 cURL로 JSON을 한 건 보냅니다.'],
    ['3','매핑 설정','수신 샘플에서 고객명·전화번호·이메일·문의내용 필드를 연결합니다. 전화번호는 필수입니다.'],
    ['4','저장 후 재처리','매핑 전에 받은 MAPPING_REQUIRED 샘플은 선택 샘플 재처리로 CallTag 문의로 변환합니다.'],
  ]){
    const item=el('div','webhook-guide-step');
    item.append(el('span','webhook-guide-step-num',num),el('strong','',title),el('p','',desc));steps.appendChild(item);
  }
  body.appendChild(steps);

  body.append(codeBlock('테스트 cURL',curl));
  body.append(codeBlock('테스트 JSON',payloadText));

  const mapExample=el('div','webhook-guide-map');
  mapExample.appendChild(el('strong','','이 샘플의 매핑 예'));
  for(const [label,pointer] of [
    ['고객명','/lead/customer/name'],
    ['전화번호','/lead/customer/phone'],
    ['이메일','/lead/customer/email'],
    ['문의내용','/lead/message'],
    ['외부 문의 ID','/lead/id'],
    ['접수일시','/lead/submitted_at'],
  ]){
    const row=el('div','webhook-guide-map-row');row.append(el('b','',label),el('code','',pointer));mapExample.appendChild(row);
  }
  body.appendChild(mapExample);

  const idem=el('section','webhook-guide-idem');
  idem.append(el('strong','','중복 방지 헤더'));
  const idemText=el('p','','아래 헤더 중 하나가 있으면 해당 값으로 중복을 구분합니다. 아무 헤더도 없으면 같은 JSON payload의 SHA-256을 fallback으로 사용합니다.');
  idem.appendChild(idemText);
  const chips=el('div','webhook-guide-chips');
  for(const name of ['Idempotency-Key','X-Webhook-Id','X-Delivery-Id','X-Request-Id','X-Event-Id'])chips.appendChild(el('code','',name));
  idem.appendChild(chips);body.appendChild(idem);

  const statuses=el('section','webhook-guide-statuses');
  statuses.appendChild(el('strong','','수신 상태'));
  for(const [name,desc] of [
    ['MAPPING_REQUIRED','JSON은 정상 수신됐지만 아직 전화번호 등 필드 매핑이 없습니다.'],
    ['MAPPED','샘플을 canonical 문의로 변환해 CallTag 수신 흐름에 넣었습니다.'],
    ['REJECTED','수신은 인정했지만 매핑된 값 검증 또는 변환에 실패했습니다. 매핑/샘플을 확인하세요.'],
  ]){
    const row=el('div','webhook-guide-status-row');row.append(el('code','',name),el('span','',desc));statuses.appendChild(row);
  }
  body.appendChild(statuses);

  const limits=el('div','webhook-guide-limits');
  for(const [label,value] of [
    ['Body 제한','최대 256KB'],
    ['Burst 제한','연결당 1분 300건'],
    ['원문 보관','연결 설정에 따라 1~30일 · 기본 7일'],
    ['응답 전략','매핑 실패도 외부 서비스의 무한 재전송을 피하도록 수신 자체는 인정하고 내부 상태로 기록'],
  ]){
    const row=el('div','');row.append(el('b','',label),el('span','',value));limits.appendChild(row);
  }
  body.appendChild(limits);

  const trouble=el('section','webhook-guide-trouble');
  trouble.appendChild(el('strong','','문제가 생기면'));
  for(const text of [
    '샘플이 안 보이면 Webhook URL이 현재 활성 URL인지 확인하고 샘플 새로고침을 누릅니다.',
    '전화번호 필드 값을 확인해주세요. → 실제 전화번호 값이 들어 있는 JSON Pointer를 다시 지정합니다.',
    '이메일 필드 값을 확인해주세요. → 이메일 형식 또는 이메일 매핑을 확인합니다.',
    '필드 매핑이 필요합니다. → 전화번호를 포함한 매핑을 저장합니다.',
    'URL이 외부에 노출됐으면 기존 URL을 계속 쓰지 말고 URL 교체를 실행합니다.',
  ])trouble.appendChild(el('p','',text));
  body.appendChild(trouble);

  details.appendChild(body);root.textContent='';root.appendChild(details);
})();
