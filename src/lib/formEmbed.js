const DEFAULT_API_URL = 'https://pagero.kr/api/leads';
const PAGERO_URL = 'https://pagero.kr';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeText(value = '', fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeQuestion(question = {}) {
  return {
    id: safeText(question.id, `q_${Math.random().toString(36).slice(2, 8)}`),
    label: safeText(question.label, '질문'),
    type: safeText(question.type, 'short'),
    required: !!question.required,
    placeholder: safeText(question.placeholder, ''),
    options: Array.isArray(question.options) ? question.options.map((item) => safeText(item)).filter(Boolean) : [],
  };
}

function normalizePage(page = {}) {
  const projectId = safeText(page.projectId || page.id || '');
  const slug = safeText(page.slug || '');
  return {
    id: safeText(page.id || ''),
    projectId,
    slug,
    title: safeText(page.title || page.name || ''),
  };
}

function fieldMarkup(question = {}) {
  const id = `pagero-${escapeHtml(question.id)}`;
  const required = question.required ? ' required' : '';
  const placeholder = escapeHtml(question.placeholder || question.label || '');
  const label = `${escapeHtml(question.label)}${question.required ? '<b>*</b>' : ''}`;
  if (question.type === 'long') {
    return `<label class="pagero-form-field" for="${id}"><span>${label}</span><textarea id="${id}" name="${escapeHtml(question.id)}" placeholder="${placeholder}"${required}></textarea></label>`;
  }
  if (question.type === 'select') {
    const options = question.options.length ? question.options : ['선택 1', '선택 2'];
    return `<label class="pagero-form-field" for="${id}"><span>${label}</span><select id="${id}" name="${escapeHtml(question.id)}"${required}><option value="">선택</option>${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}</select></label>`;
  }
  if (question.type === 'multi') {
    const options = question.options.length ? question.options : ['선택 1', '선택 2'];
    return `<fieldset class="pagero-form-field pagero-form-checks"><legend>${label}</legend>${options.map((option, index) => `<label><input type="checkbox" name="${escapeHtml(question.id)}" value="${escapeHtml(option)}"${index === 0 && question.required ? ' data-required-group="1"' : ''}>${escapeHtml(option)}</label>`).join('')}</fieldset>`;
  }
  const inputType = question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : 'text';
  return `<label class="pagero-form-field" for="${id}"><span>${label}</span><input id="${id}" type="${inputType}" name="${escapeHtml(question.id)}" placeholder="${placeholder}"${required}></label>`;
}

export function generateStandaloneFormHtml(form = {}, page = {}) {
  const safePage = normalizePage(page);
  const questions = Array.isArray(form.questions) ? form.questions.map(normalizeQuestion) : [];
  const config = {
    apiUrl: DEFAULT_API_URL,
    brand: '페이지로',
    formId: safeText(form.id || form.blockId || ''),
    title: safeText(form.title, '상담 신청'),
    desc: safeText(form.desc || ''),
    submit: safeText(form.submit, '접수하기'),
    successTitle: safeText(form.successTitle, '접수 완료'),
    success: safeText(form.success, '접수가 완료되었습니다. 확인 후 연락드리겠습니다.'),
    privacy: safeText(form.privacy, '개인정보 수집 및 이용에 동의합니다.'),
    privacyRequired: form.privacyRequired !== false,
    page: safePage,
    project: {
      projectId: safePage.projectId,
      slug: safePage.slug,
    },
    questions,
  };

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(config.title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#101827;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}.pagero-form-wrap{width:min(100%,520px);margin:0 auto;padding:20px}.pagero-form-card{background:#fff;border:1px solid #d9e2ef;border-radius:22px;padding:24px;box-shadow:0 18px 42px rgba(15,23,42,.08)}.pagero-form-card h2{margin:0 0 8px;font-size:26px;line-height:1.2}.pagero-form-card p{margin:0 0 18px;color:#64748b;font-weight:700;line-height:1.55}.pagero-form-field{display:block;margin:0 0 14px}.pagero-form-field span,.pagero-form-checks legend{display:block;margin:0 0 8px;font-weight:900;font-size:14px}.pagero-form-field b{color:#2563eb;margin-left:4px}.pagero-form-field input,.pagero-form-field textarea,.pagero-form-field select{width:100%;border:1px solid #d8e2ef;border-radius:16px;background:#f8fbff;padding:15px 16px;font:inherit;font-weight:800;color:#101827;outline:none}.pagero-form-field textarea{min-height:112px;resize:vertical}.pagero-form-field input:focus,.pagero-form-field textarea:focus,.pagero-form-field select:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12)}.pagero-form-checks{border:0;margin:0 0 14px;padding:0}.pagero-form-checks label{display:flex;gap:8px;align-items:center;margin:8px 0;font-weight:800}.pagero-form-privacy{display:flex;gap:10px;align-items:flex-start;margin:16px 0;color:#334155;font-size:13px;font-weight:800}.pagero-form-privacy input{margin-top:2px}.pagero-form-submit{width:100%;border:0;border-radius:18px;background:#101827;color:#fff;padding:16px;font:inherit;font-weight:900;cursor:pointer}.pagero-form-submit:disabled{opacity:.58;cursor:not-allowed}.pagero-form-notice{display:none;margin-top:14px;border-radius:14px;padding:13px 14px;font-weight:900;line-height:1.4}.pagero-form-notice.show{display:block}.pagero-form-notice.ok{background:#dcfce7;color:#047857}.pagero-form-notice.error{background:#fee2e2;color:#dc2626}.pagero-powered{display:block;margin:14px auto 0;text-align:center;color:#64748b;text-decoration:none;font-size:12px;font-weight:900}.pagero-powered:hover{color:#2563eb}
</style>
</head>
<body>
<div class="pagero-form-wrap">
  <form class="pagero-form-card" data-pagero-form>
    <h2>${escapeHtml(config.title)}</h2>
    ${config.desc ? `<p>${escapeHtml(config.desc)}</p>` : ''}
    ${questions.map(fieldMarkup).join('\n    ')}
    ${config.privacyRequired ? `<label class="pagero-form-privacy"><input type="checkbox" name="privacy" required><span>${escapeHtml(config.privacy)}</span></label>` : ''}
    <button class="pagero-form-submit" type="submit">${escapeHtml(config.submit)}</button>
    <div class="pagero-form-notice" data-pagero-notice></div>
  </form>
  <a class="pagero-powered" href="${PAGERO_URL}" target="_blank" rel="noopener">페이지로로 제작됨</a>
</div>
<script>
window.PAGERO_FORM_CONFIG=${JSON.stringify(config)};
(function(){
  var cfg=window.PAGERO_FORM_CONFIG||{};
  var form=document.querySelector('[data-pagero-form]');
  var notice=document.querySelector('[data-pagero-notice]');
  var submit=form&&form.querySelector('button[type="submit"]');
  if(!form)return;
  function text(value){return Array.isArray(value)?value.join(', '):String(value||'');}
  function setNotice(message,type){
    if(!notice)return;
    notice.textContent=message;
    notice.className='pagero-form-notice show '+(type||'ok');
  }
  function channelFromReferrer(referrer){
    try{
      var host=new URL(referrer).hostname.toLowerCase();
      if(host.indexOf('naver.')>=0)return 'naver';
      if(host.indexOf('google.')>=0)return 'google';
      if(host.indexOf('kakao.')>=0||host.indexOf('daum.')>=0)return 'kakao';
      if(host.indexOf('instagram.')>=0)return 'instagram';
      if(host.indexOf('facebook.')>=0||host.indexOf('fb.')>=0)return 'meta';
      if(host.indexOf('youtube.')>=0||host.indexOf('youtu.be')>=0)return 'youtube';
      return 'referral';
    }catch(e){return 'direct';}
  }
  function traffic(){
    var params=new URL(location.href).searchParams;
    var utmSource=String(params.get('utm_source')||'').trim().toLowerCase();
    var utmMedium=String(params.get('utm_medium')||'').trim().toLowerCase();
    var utmCampaign=String(params.get('utm_campaign')||'').trim();
    var referrer=document.referrer||'';
    var channel=utmSource||channelFromReferrer(referrer);
    var labels={direct:'직접 유입',referral:'외부 링크',naver:'네이버',google:'구글',kakao:'카카오',instagram:'인스타그램',meta:'페이스북/메타',youtube:'유튜브'};
    return {channel:channel,utmSource:utmSource,utmMedium:utmMedium,utmCampaign:utmCampaign,sourceUrl:location.href,referrer:referrer,sourceLabel:(labels[channel]||channel||'직접 유입')+(utmCampaign?' · '+utmCampaign:'')};
  }
  function valuesFromForm(){
    var data=new FormData(form);
    var values={};
    var answers=[];
    (cfg.questions||[]).forEach(function(q){
      var value=q.type==='multi'?data.getAll(q.id):data.get(q.id);
      if(Array.isArray(value))value=value.filter(Boolean);
      values[q.label]=value;
      values[q.id]=value;
      answers.push({id:q.id,label:q.label,type:q.type,required:!!q.required,value:value});
    });
    return {values:values,answers:answers};
  }
  function firstAnswer(answers,types,pattern){
    for(var i=0;i<answers.length;i++){
      var a=answers[i];
      var label=String(a.label||'');
      if(types.indexOf(a.type)>=0||pattern.test(label))return text(a.value);
    }
    return '';
  }
  function postJson(url,payload){
    return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  form.addEventListener('submit',function(event){
    event.preventDefault();
    if(submit)submit.disabled=true;
    var extracted=valuesFromForm();
    var now=new Date().toISOString();
    var t=traffic();
    var lead=Object.assign({
      id:'embed_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      type:'상담',
      kind:'consult',
      formId:cfg.formId||'',
      source:'embed',
      sourceBlockTitle:cfg.title||'',
      brand:cfg.brand||'페이지로',
      name:firstAnswer(extracted.answers,['name'],/이름|성함|name/i),
      phone:firstAnswer(extracted.answers,['phone'],/전화|연락|휴대|phone/i),
      email:firstAnswer(extracted.answers,['email'],/메일|email/i),
      address:firstAnswer(extracted.answers,['address'],/주소|address/i),
      message:firstAnswer(extracted.answers,['long'],/문의|내용|메시지|message/i),
      values:extracted.values,
      answers:extracted.answers,
      createdAt:now,
      createdMonth:now.slice(0,7)
    },t);
    var payload={lead:lead,page:cfg.page||{},project:cfg.project||{}};
    var hasProject=payload.project&&payload.project.projectId&&payload.project.slug;
    var request=hasProject&&cfg.apiUrl
      ? postJson(cfg.apiUrl,payload).then(function(res){if(!res.ok)throw new Error('server '+res.status);return res.json().catch(function(){return {};});})
      : Promise.reject(new Error('missing project'));
    request.then(function(){
      form.reset();
      setNotice(cfg.success||'접수가 완료되었습니다.','ok');
    }).catch(function(){
      setNotice('접수 저장에 실패했습니다. 잠시 후 다시 시도해주세요.','error');
    }).finally(function(){
      if(submit)submit.disabled=false;
    });
  });
})();
</script>
</body>
</html>`;
}
