(()=>{
  const $=(id)=>document.getElementById(id);
  const seenEmpty=new WeakSet();

  function setLiveRegions(){
    document.querySelectorAll('.notice,.health-message,.mapper-notice').forEach((node)=>{
      node.setAttribute('role','status');
      node.setAttribute('aria-live','polite');
      node.setAttribute('aria-atomic','true');
    });
    document.querySelectorAll('.status,.health-badge').forEach((node)=>{
      node.setAttribute('aria-live','polite');
      node.setAttribute('aria-atomic','true');
    });
  }

  function syncTabs(){
    document.querySelectorAll('[data-section]').forEach((button)=>{
      const active=button.classList.contains('active');
      button.setAttribute('aria-selected',active?'true':'false');
      button.setAttribute('role','tab');
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    const tabs=$('detailTabs');if(tabs)tabs.setAttribute('role','tablist');
  }

  function riskHints(){
    const hints={
      'URL 교체':'교체 즉시 이전 Webhook URL은 사용할 수 없습니다.',
      '연결 해제':'이 연결에서 새 문의 수신이 중단됩니다.',
      '키 교체':'새 키가 발급되며 기존 API Key는 즉시 폐기됩니다.',
      '키 폐기':'이 API Key를 사용하는 외부 연동이 즉시 중단됩니다.',
      '재연결':'Meta 로그인을 다시 진행해 연결 권한을 갱신합니다.',
    };
    document.querySelectorAll('button').forEach((button)=>{
      const hint=hints[button.textContent.trim()];
      if(hint&&!button.title)button.title=hint;
    });
  }

  function emptyCta(rootId,buttonId,label){
    const root=$(rootId);const target=$(buttonId);
    if(!root||!target)return;
    const empty=[...root.children].find((node)=>node.classList?.contains('empty'));
    if(!empty||seenEmpty.has(empty))return;
    seenEmpty.add(empty);
    empty.classList.add('connect-empty-enhanced');
    const action=document.createElement('button');
    action.type='button';action.className='connect-empty-action';action.textContent=label;
    action.onclick=()=>target.click();
    empty.appendChild(action);
  }

  function enhanceEmptyStates(){
    emptyCta('connectionList','startMeta','Meta 연결하기');
    emptyCta('webhookList','toggleWebhookCreate','Webhook 만들기');
    emptyCta('apiList','toggleApiCreate','API Key 만들기');
  }

  function labelControls(){
    document.querySelectorAll('.row-actions').forEach((row)=>row.setAttribute('role','group'));
    const source=$('activitySource');if(source&&!source.title)source.title='문의 소스 필터';
    const status=$('activityStatus');if(status&&!status.title)status.title='전달 상태 필터';
    document.querySelectorAll('.secret-box.show').forEach((box)=>{
      box.setAttribute('role','region');box.setAttribute('aria-label','한 번만 표시되는 연결 비밀값');
    });
  }

  function enhance(){setLiveRegions();syncTabs();riskHints();enhanceEmptyStates();labelControls()}

  let queued=false;
  const schedule=()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;enhance()});
  };
  document.addEventListener('calltag:connect-ui-updated',schedule);
  document.addEventListener('click',schedule,true);
  document.addEventListener('keydown',(event)=>{
    if(event.key!=='Escape')return;
    const webhookForm=$('webhookCreateForm');
    const apiForm=$('apiCreateForm');
    if(webhookForm&&!webhookForm.classList.contains('hidden'))webhookForm.classList.add('hidden');
    if(apiForm&&!apiForm.classList.contains('hidden'))apiForm.classList.add('hidden');
  });
  enhance();
})();