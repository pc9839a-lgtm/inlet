(function () {
  'use strict';

  var API_URL = 'https://pagero.kr/api/leads';
  var HOME_URL = 'https://pagero.kr';
  var SCRIPT_SELECTOR = 'script[src*="/embed/form.js"]';

  function css() {
    if (document.getElementById('pagero-form-style')) return;
    var style = document.createElement('style');
    style.id = 'pagero-form-style';
    style.textContent = '*{box-sizing:border-box}.pagero-form-wrap{width:min(100%,520px);margin:0 auto;padding:20px;color:#101827;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}.pagero-form-card{background:#fff;border:1px solid #d9e2ef;border-radius:22px;padding:24px;box-shadow:0 18px 42px rgba(15,23,42,.08)}.pagero-form-card h2{margin:0 0 8px;font-size:26px;line-height:1.2}.pagero-form-card p{margin:0 0 18px;color:#64748b;font-weight:700;line-height:1.55}.pagero-form-field{display:block;margin:0 0 14px}.pagero-form-field span,.pagero-form-checks legend{display:block;margin:0 0 8px;font-weight:900;font-size:14px}.pagero-form-field b{color:#2563eb;margin-left:4px}.pagero-form-field input,.pagero-form-field textarea,.pagero-form-field select{width:100%;border:1px solid #d8e2ef;border-radius:16px;background:#f8fbff;padding:15px 16px;font:inherit;font-weight:800;color:#101827;outline:none}.pagero-form-field textarea{min-height:112px;resize:vertical}.pagero-form-field input:focus,.pagero-form-field textarea:focus,.pagero-form-field select:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12)}.pagero-form-checks{border:0;margin:0 0 14px;padding:0}.pagero-form-checks label{display:flex;gap:8px;align-items:center;margin:8px 0;font-weight:800}.pagero-form-privacy{display:flex;gap:10px;align-items:flex-start;margin:16px 0;color:#334155;font-size:13px;font-weight:800}.pagero-form-privacy input{margin-top:2px}.pagero-form-submit{width:100%;border:0;border-radius:18px;background:#101827;color:#fff;padding:16px;font:inherit;font-weight:900;cursor:pointer}.pagero-form-submit:disabled{opacity:.58;cursor:not-allowed}.pagero-form-notice{display:none;margin-top:14px;border-radius:14px;padding:13px 14px;font-weight:900;line-height:1.4}.pagero-form-notice.show{display:block}.pagero-form-notice.ok{background:#dcfce7;color:#047857}.pagero-form-notice.error{background:#fee2e2;color:#dc2626}.pagero-powered{display:block;margin:14px auto 0;text-align:center;color:#64748b;text-decoration:none;font-size:12px;font-weight:900}.pagero-powered:hover{color:#2563eb}';
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function text(value) {
    return Array.isArray(value) ? value.join(', ') : String(value || '');
  }

  function fieldMarkup(q) {
    q = q || {};
    var safeId = String(q.id || ('q_' + Math.random().toString(36).slice(2, 8)));
    var id = 'pagero-' + esc(safeId);
    var required = q.required ? ' required' : '';
    var label = esc(q.label || '질문') + (q.required ? '<b>*</b>' : '');
    var placeholder = esc(q.placeholder || q.label || '');
    if (q.type === 'long') return '<label class="pagero-form-field" for="' + id + '"><span>' + label + '</span><textarea id="' + id + '" name="' + esc(safeId) + '" placeholder="' + placeholder + '"' + required + '></textarea></label>';
    if (q.type === 'select') {
      var selectOptions = (q.options && q.options.length ? q.options : ['선택 1', '선택 2']).map(function (option) {
        return '<option value="' + esc(option) + '">' + esc(option) + '</option>';
      }).join('');
      return '<label class="pagero-form-field" for="' + id + '"><span>' + label + '</span><select id="' + id + '" name="' + esc(safeId) + '"' + required + '><option value="">선택</option>' + selectOptions + '</select></label>';
    }
    if (q.type === 'multi') {
      var checks = (q.options && q.options.length ? q.options : ['선택 1', '선택 2']).map(function (option, index) {
        return '<label><input type="checkbox" name="' + esc(safeId) + '" value="' + esc(option) + '"' + (index === 0 && q.required ? ' data-required-group="1"' : '') + '>' + esc(option) + '</label>';
      }).join('');
      return '<fieldset class="pagero-form-field pagero-form-checks"><legend>' + label + '</legend>' + checks + '</fieldset>';
    }
    var inputType = q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text';
    return '<label class="pagero-form-field" for="' + id + '"><span>' + label + '</span><input id="' + id + '" type="' + inputType + '" name="' + esc(safeId) + '" placeholder="' + placeholder + '"' + required + '></label>';
  }

  function channelFromReferrer(referrer) {
    try {
      var host = new URL(referrer).hostname.toLowerCase();
      if (host.indexOf('naver.') >= 0) return 'naver';
      if (host.indexOf('google.') >= 0) return 'google';
      if (host.indexOf('kakao.') >= 0 || host.indexOf('daum.') >= 0) return 'kakao';
      if (host.indexOf('instagram.') >= 0) return 'instagram';
      if (host.indexOf('facebook.') >= 0 || host.indexOf('fb.') >= 0) return 'meta';
      if (host.indexOf('youtube.') >= 0 || host.indexOf('youtu.be') >= 0) return 'youtube';
      return 'referral';
    } catch (e) {
      return 'direct';
    }
  }

  function traffic() {
    var params = new URL(location.href).searchParams;
    var utmSource = String(params.get('utm_source') || '').trim().toLowerCase();
    var utmMedium = String(params.get('utm_medium') || '').trim().toLowerCase();
    var utmCampaign = String(params.get('utm_campaign') || '').trim();
    var referrer = document.referrer || '';
    var channel = utmSource || channelFromReferrer(referrer);
    var labels = {
      direct: '직접 유입',
      referral: '외부 링크',
      naver: '네이버',
      google: '구글',
      kakao: '카카오',
      instagram: '인스타그램',
      meta: '페이스북/메타',
      youtube: '유튜브'
    };
    return {
      channel: channel,
      utmSource: utmSource,
      utmMedium: utmMedium,
      utmCampaign: utmCampaign,
      sourceUrl: location.href,
      referrer: referrer,
      sourceLabel: (labels[channel] || channel || '직접 유입') + (utmCampaign ? ' · ' + utmCampaign : '')
    };
  }

  function valuesFromForm(form, questions) {
    var data = new FormData(form);
    var values = {};
    var answers = [];
    questions.forEach(function (q) {
      var value = q.type === 'multi' ? data.getAll(q.id).filter(Boolean) : data.get(q.id);
      values[q.label] = value;
      values[q.id] = value;
      answers.push({ id: q.id, label: q.label, type: q.type, required: !!q.required, value: value });
    });
    return { values: values, answers: answers };
  }

  function firstAnswer(answers, types, pattern) {
    for (var i = 0; i < answers.length; i += 1) {
      var a = answers[i];
      if (types.indexOf(a.type) >= 0 || pattern.test(String(a.label || ''))) return text(a.value);
    }
    return '';
  }

  function postJson(url, payload) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }

  function decodeConfig(raw) {
    if (!raw) return {};
    try {
      var base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      if (typeof TextDecoder !== 'undefined') return JSON.parse(new TextDecoder().decode(bytes));
      var escaped = '';
      for (var j = 0; j < binary.length; j += 1) escaped += '%' + ('00' + binary.charCodeAt(j).toString(16)).slice(-2);
      return JSON.parse(decodeURIComponent(escaped));
    } catch (e) {
      return JSON.parse(decodeURIComponent(raw));
    }
  }

  function render(target, cfg) {
    css();
    cfg = cfg || {};
    cfg.questions = Array.isArray(cfg.questions) ? cfg.questions : [];
    target.innerHTML = '<div class="pagero-form-wrap"><form class="pagero-form-card" data-pagero-form><h2>' + esc(cfg.title || '상담 신청') + '</h2>' + (cfg.desc ? '<p>' + esc(cfg.desc) + '</p>' : '') + cfg.questions.map(fieldMarkup).join('') + (cfg.privacyRequired !== false ? '<label class="pagero-form-privacy"><input type="checkbox" name="privacy" required><span>' + esc(cfg.privacy || '개인정보 수집 및 이용에 동의합니다.') + '</span></label>' : '') + '<button class="pagero-form-submit" type="submit">' + esc(cfg.submit || '접수하기') + '</button><div class="pagero-form-notice" data-pagero-notice></div></form><a class="pagero-powered" href="' + HOME_URL + '" target="_blank" rel="noopener">페이지로로 제작됨</a></div>';

    var form = target.querySelector('[data-pagero-form]');
    var notice = target.querySelector('[data-pagero-notice]');
    var submit = form.querySelector('button[type="submit"]');
    function setNotice(message, type) {
      notice.textContent = message;
      notice.className = 'pagero-form-notice show ' + (type || 'ok');
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit.disabled = true;
      var extracted = valuesFromForm(form, cfg.questions);
      var now = new Date().toISOString();
      var lead = Object.assign({
        id: 'embed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        type: '상담',
        kind: 'consult',
        formId: cfg.formId || '',
        source: 'embed',
        sourceBlockTitle: cfg.title || '',
        brand: cfg.brand || '페이지로',
        name: firstAnswer(extracted.answers, ['name'], /이름|성함|name/i),
        phone: firstAnswer(extracted.answers, ['phone'], /전화|연락|휴대|phone/i),
        email: firstAnswer(extracted.answers, ['email'], /메일|email/i),
        address: firstAnswer(extracted.answers, ['address'], /주소|address/i),
        message: firstAnswer(extracted.answers, ['long'], /문의|내용|메시지|message/i),
        values: extracted.values,
        answers: extracted.answers,
        createdAt: now,
        createdMonth: now.slice(0, 7)
      }, traffic());
      var payload = { lead: lead, page: cfg.page || {}, project: cfg.project || {} };
      var hasProject = payload.project && payload.project.projectId && payload.project.slug;
      var request = hasProject ? postJson(API_URL, payload).then(function (res) {
        if (!res.ok) throw new Error('server ' + res.status);
        return res.json().catch(function () { return {}; });
      }) : Promise.reject(new Error('missing project'));
      request.then(function () {
        form.reset();
        setNotice(cfg.success || '접수가 완료되었습니다.', 'ok');
      }).catch(function () {
        setNotice('접수 저장에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
      }).finally(function () {
        submit.disabled = false;
      });
    });
  }

  function targetForScript(script) {
    if (!script || script.getAttribute('data-pagero-loaded') === '1') return null;
    var targetId = script.getAttribute('data-target');
    var target = targetId ? document.getElementById(targetId) : null;
    if (!target) {
      target = document.createElement('div');
      if (script.parentNode) script.parentNode.insertBefore(target, script);
      else document.body.appendChild(target);
    }
    script.setAttribute('data-pagero-loaded', '1');
    return target;
  }

  function init(script) {
    var target = targetForScript(script);
    if (!target) return;
    try {
      var configEl = document.getElementById(script.getAttribute('data-config') || '');
      var config = script.getAttribute('data-pagero')
        ? decodeConfig(script.getAttribute('data-pagero'))
        : JSON.parse(configEl ? configEl.textContent || '{}' : '{}');
      render(target, config);
    } catch (e) {
      target.textContent = '페이지로 입력폼을 불러오지 못했습니다.';
    }
  }

  function initAll() {
    var scripts = document.querySelectorAll(SCRIPT_SELECTOR);
    for (var i = 0; i < scripts.length; i += 1) {
      if (scripts[i].getAttribute('data-pagero') || scripts[i].getAttribute('data-config') || scripts[i].getAttribute('data-target')) {
        init(scripts[i]);
      }
    }
  }

  init(document.currentScript);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
}());
