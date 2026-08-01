const METHODS = 'GET, HEAD, OPTIONS';

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: METHODS,
        'Cache-Control': 'no-store',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: METHODS } });
  }

  const html = String.raw`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>페이지로 운영 감사</title>
  <style>
    :root{font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f4f7fb}
    *{box-sizing:border-box}body{margin:0}.shell{width:min(1320px,calc(100% - 28px));margin:0 auto;padding:24px 0 52px;display:grid;gap:14px}
    .hero,.card,.tabs{background:#fff;border:1px solid #dbe5f2;border-radius:22px;box-shadow:0 14px 40px rgba(15,23,42,.06)}
    .hero{padding:24px;background:#111827;color:#fff;display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.hero h1{margin:8px 0 6px;font-size:30px}.hero p{margin:0;color:#cbd5e1;font-size:13px;line-height:1.55}.eyebrow{font-size:11px;font-weight:900;color:#93c5fd}
    button,a{font:inherit}.hero a,.tabs button,.actions button,.load-more{min-height:42px;border:0;border-radius:13px;padding:0 14px;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none}.hero a{display:inline-flex;align-items:center;background:#fff;color:#111827}.tabs{padding:7px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.tabs button{background:transparent;color:#64748b}.tabs button.active{background:#111827;color:#fff}
    .status{min-height:48px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#1e3a8a;padding:12px 14px;font-size:13px;font-weight:800;display:flex;align-items:center}.status.error{border-color:#fecaca;background:#fff1f2;color:#b91c1c}
    .card{padding:18px;display:grid;gap:14px}.card h2{margin:0;font-size:18px}.card p{margin:0;color:#64748b;font-size:12px;font-weight:700}.filters{display:grid;grid-template-columns:2fr repeat(4,minmax(120px,1fr)) auto;gap:8px}.filters input,.filters select{width:100%;height:42px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;padding:0 11px;color:#111827;font-size:12px;font-weight:700}.filters button{height:42px;border:0;border-radius:12px;background:#2563eb;color:#fff;padding:0 16px;font-weight:900;cursor:pointer}
    .table-wrap{overflow:auto}.table{min-width:980px;display:grid;gap:7px}.row{display:grid;grid-template-columns:170px 180px 160px 150px minmax(240px,1fr) 150px;gap:8px;align-items:center;min-height:52px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.row.head{min-height:34px;border:0;background:transparent;color:#64748b;font-size:11px;font-weight:900}.row span,.row code{min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row code{color:#334155}.project-row{grid-template-columns:minmax(220px,1.4fr) 170px 190px 110px 170px}.actions{display:flex;gap:6px;justify-content:flex-end}.actions button{min-height:34px;border:1px solid #cbd5e1;background:#fff;color:#111827;padding:0 10px;font-size:11px}.actions button.primary{border-color:#111827;background:#111827;color:#fff}.actions button:disabled{opacity:.45;cursor:not-allowed}.empty{min-height:70px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}.load-more{justify-self:center;background:#111827;color:#fff}.hidden{display:none!important}
    @media(max-width:900px){.shell{width:min(100% - 16px,760px);padding-top:10px}.hero{align-items:flex-start;flex-direction:column}.filters{grid-template-columns:1fr 1fr}.filters input:first-child{grid-column:1/-1}.filters button{grid-column:1/-1}.row{min-width:900px}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div><span class="eyebrow">PAGERO INTERNAL</span><h1>운영 감사</h1><p>감사 기록을 검색하고 페이지를 일시중지·복원합니다. 일반 사용자 메뉴에는 노출되지 않습니다.</p></div>
      <a href="/admin">전체 관리자</a>
    </header>
    <div id="status" class="status">운영자 세션을 확인하고 있습니다.</div>
    <nav class="tabs" aria-label="운영 감사 메뉴">
      <button type="button" data-view="audit" class="active">감사 로그</button>
      <button type="button" data-view="projects">페이지 상태</button>
    </nav>

    <section id="audit-view" class="card">
      <div><h2>감사 로그</h2><p>작업·실행자·프로젝트·기간 기준으로 검색합니다. IP와 User-Agent 원문은 제공되지 않습니다.</p></div>
      <form id="audit-filters" class="filters">
        <input name="q" type="search" placeholder="작업, 프로젝트, 대상 검색" aria-label="감사 로그 검색">
        <input name="action" placeholder="작업 코드" aria-label="작업 코드">
        <input name="projectId" placeholder="프로젝트 ID" aria-label="프로젝트 ID">
        <select name="targetType" aria-label="대상 종류"><option value="">전체 대상</option><option value="account">계정</option><option value="project">프로젝트</option><option value="project_member">매니저</option><option value="ownership_transfer">소유권 이전</option><option value="manager_invite">초대</option></select>
        <input name="dateFrom" type="date" aria-label="시작 날짜">
        <button type="submit">조회</button>
      </form>
      <div class="table-wrap"><div id="audit-table" class="table"></div></div>
      <button id="audit-more" type="button" class="load-more hidden">더 보기</button>
    </section>

    <section id="projects-view" class="card hidden">
      <div><h2>페이지 상태</h2><p>일시중지는 기존 보관 상태를 사용해 공개 페이지를 즉시 내리고, 복원하면 다시 활성화합니다.</p></div>
      <div class="filters"><input id="project-query" type="search" placeholder="페이지명, 주소, 소유자 검색" aria-label="페이지 검색"><select id="project-status" aria-label="페이지 상태"><option value="">전체 상태</option><option value="active">활성</option><option value="archived">중지·보관</option></select><button id="project-refresh" type="button">새로고침</button></div>
      <div class="table-wrap"><div id="project-table" class="table"></div></div>
    </section>
  </main>
<script>
(function(){
  var AUTH_KEY='inlet-auth-v1';
  var state={session:'',audit:[],auditCursor:0,auditHasMore:false,projects:[],projectBusy:''};
  var statusEl=document.getElementById('status');
  var auditTable=document.getElementById('audit-table');
  var projectTable=document.getElementById('project-table');
  var auditMore=document.getElementById('audit-more');

  function parseAuth(){
    try{
      var raw=localStorage.getItem(AUTH_KEY)||'';
      var value=raw?JSON.parse(raw):null;
      if(typeof value==='string') value=JSON.parse(value);
      return value&&typeof value==='object'?value:{};
    }catch(error){return {};}
  }
  function setStatus(message,error){statusEl.textContent=message;statusEl.className=error?'status error':'status';}
  function text(value){return value==null?'':String(value);}
  function shortDate(value){return text(value).replace('T',' ').slice(0,16)||'-';}
  function node(tag,className,value){var item=document.createElement(tag);if(className)item.className=className;if(value!==undefined)item.textContent=text(value);return item;}
  function clear(element){while(element.firstChild)element.removeChild(element.firstChild);}
  function sessionHeaders(extra){var headers={'X-Inlet-Session':state.session};if(extra)Object.keys(extra).forEach(function(key){headers[key]=extra[key];});return headers;}
  async function api(path,options){
    var opts=options||{};opts.headers=sessionHeaders(opts.headers||{});opts.cache='no-store';
    var response=await fetch(path,opts);var data=await response.json().catch(function(){return {};});
    if(!response.ok){var error=new Error(data.error||data.message||('HTTP '+response.status));error.status=response.status;throw error;}return data;
  }
  function auditHead(){var row=node('div','row head');['시각','작업','실행자','대상','세부정보','프로젝트'].forEach(function(label){row.appendChild(node('span','',label));});return row;}
  function renderAudit(){
    clear(auditTable);auditTable.appendChild(auditHead());
    if(!state.audit.length){auditTable.appendChild(node('div','empty','감사 기록이 없습니다.'));return;}
    state.audit.forEach(function(item){
      var row=node('div','row');
      row.appendChild(node('span','',shortDate(item.createdAt)));
      row.appendChild(node('span','',item.action||'-'));
      row.appendChild(node('span','',item.actor&&item.actor.email?item.actor.email:(item.actorAccountId||'-')));
      row.appendChild(node('span','',(item.targetType||'-')+' · '+(item.targetId||'-')));
      row.appendChild(node('code','',JSON.stringify(item.metadata||{})));
      row.appendChild(node('span','',item.project?(item.project.title||item.project.slug||item.project.id):(item.projectId||'-')));
      auditTable.appendChild(row);
    });
    auditMore.classList.toggle('hidden',!state.auditHasMore);
  }
  function auditParams(cursor){
    var form=new FormData(document.getElementById('audit-filters'));var params=new URLSearchParams();
    form.forEach(function(value,key){if(text(value).trim())params.set(key,text(value).trim());});
    params.set('limit','50');params.set('cursor',text(cursor||0));return params;
  }
  async function loadAudit(append){
    try{
      setStatus('감사 로그를 불러오는 중입니다.',false);
      var cursor=append?state.auditCursor:0;var data=await api('/api/admin/audit?'+auditParams(cursor).toString());
      state.audit=append?state.audit.concat(data.records||[]):(data.records||[]);state.auditCursor=data.nextCursor||0;state.auditHasMore=!!data.hasMore;renderAudit();setStatus('감사 로그 '+text(data.total||state.audit.length)+'건을 확인했습니다.',false);
    }catch(error){setStatus(error.status===403?'전체 관리자 권한이 없습니다.':'감사 로그 조회 실패: '+error.message,true);}
  }
  function projectHead(){var row=node('div','row head project-row');['페이지','주소','소유자','상태','운영 조치'].forEach(function(label){row.appendChild(node('span','',label));});return row;}
  function filteredProjects(){
    var q=text(document.getElementById('project-query').value).trim().toLowerCase();var filter=document.getElementById('project-status').value;
    return state.projects.filter(function(item){var status=text(item.status||'active').toLowerCase();var hay=[item.title,item.slug,item.id,item.ownerEmail].join(' ').toLowerCase();return(!q||hay.indexOf(q)>=0)&&(!filter||status===filter);});
  }
  function renderProjects(){
    clear(projectTable);projectTable.appendChild(projectHead());var rows=filteredProjects();
    if(!rows.length){projectTable.appendChild(node('div','empty','조건에 맞는 페이지가 없습니다.'));return;}
    rows.forEach(function(item){
      var row=node('div','row project-row');row.appendChild(node('span','',item.title||item.slug||item.id));row.appendChild(node('span','','/'+(item.slug||'-')));row.appendChild(node('span','',item.ownerEmail||'-'));row.appendChild(node('span','',item.status||'active'));
      var actions=node('div','actions');var active=text(item.status||'active').toLowerCase()==='active';var button=node('button',active?'':'primary',active?'일시중지':'복원');button.type='button';button.disabled=state.projectBusy===item.id;button.addEventListener('click',function(){changeProjectStatus(item,active?'pause':'restore');});actions.appendChild(button);row.appendChild(actions);projectTable.appendChild(row);
    });
  }
  async function loadProjects(){
    try{setStatus('페이지 상태를 불러오는 중입니다.',false);var data=await api('/api/admin/summary');state.projects=data.projects||[];renderProjects();setStatus('페이지 '+text(state.projects.length)+'개를 확인했습니다.',false);}catch(error){setStatus(error.status===403?'전체 관리자 권한이 없습니다.':'페이지 상태 조회 실패: '+error.message,true);}
  }
  async function changeProjectStatus(item,action){
    if(!item||!item.id)return;state.projectBusy=item.id;renderProjects();
    try{await api('/api/admin/projects/'+encodeURIComponent(item.id)+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action})});await Promise.all([loadProjects(),loadAudit(false)]);}catch(error){setStatus('페이지 상태 변경 실패: '+error.message,true);}finally{state.projectBusy='';renderProjects();}
  }
  document.querySelectorAll('[data-view]').forEach(function(button){button.addEventListener('click',function(){var view=button.getAttribute('data-view');document.querySelectorAll('[data-view]').forEach(function(item){item.classList.toggle('active',item===button);});document.getElementById('audit-view').classList.toggle('hidden',view!=='audit');document.getElementById('projects-view').classList.toggle('hidden',view!=='projects');if(view==='projects'&&!state.projects.length)loadProjects();});});
  document.getElementById('audit-filters').addEventListener('submit',function(event){event.preventDefault();loadAudit(false);});
  auditMore.addEventListener('click',function(){loadAudit(true);});document.getElementById('project-refresh').addEventListener('click',loadProjects);document.getElementById('project-query').addEventListener('input',renderProjects);document.getElementById('project-status').addEventListener('change',renderProjects);
  var auth=parseAuth();state.session=text(auth.session||'');if(!state.session){setStatus('로그인 세션이 없습니다. 먼저 전체 관리자 계정으로 로그인해주세요.',true);return;}loadAudit(false);
})();
</script>
</body>
</html>`;

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
