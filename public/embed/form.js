(function () {
  'use strict';

  var HOME_URL = 'https://pagero.kr';
  var API_URL = HOME_URL + '/api/leads';
  var SCRIPT_SELECTOR = 'script[src*="/embed/form.js"]';
  var CLIENT_ID_KEY = 'pagero_client_id';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function text(value) {
    return Array.isArray(value) ? value.join(', ') : String(value || '');
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function randomId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function css() {
    if (document.getElementById('pagero-form-style')) return;
    var style = document.createElement('style');
    style.id = 'pagero-form-style';
    style.textContent = [
      '*{box-sizing:border-box}',
      '.pagero-form-wrap{width:min(100%,520px);margin:0 auto;padding:18px;color:#101827;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}',
      '.pagero-form-card{background:#fff;border:1px solid #d9e2ef;border-radius:22px;padding:24px;box-shadow:0 18px 42px rgba(15,23,42,.08)}',
      '.pagero-form-card h2{margin:0 0 8px;font-size:26px;line-height:1.2;font-weight:900}',
      '.pagero-form-card p{margin:0 0 18px;color:#64748b;font-weight:700;line-height:1.55}',
      '.pagero-form-field{display:block;margin:0 0 14px}',
      '.pagero-form-field span,.pagero-form-checks legend{display:block;margin:0 0 8px;font-weight:900;font-size:14px}',
      '.pagero-form-field b{color:#2563eb;margin-left:4px}',
      '.pagero-form-field input,.pagero-form-field textarea,.pagero-form-field select{width:100%;border:1px solid #d8e2ef;border-radius:16px;background:#f8fbff;padding:15px 16px;font:inherit;font-weight:800;color:#101827;outline:none}',
      '.pagero-form-field textarea{min-height:112px;resize:vertical}',
      '.pagero-form-field input:focus,.pagero-form-field textarea:focus,.pagero-form-field select:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12)}',
      '.pagero-form-checks{border:0;margin:0 0 14px;padding:0}',
      '.pagero-form-checks label{display:flex;gap:8px;align-items:center;margin:8px 0;font-weight:800}',
      '.pagero-form-privacy{display:flex;gap:10px;align-items:flex-start;margin:16px 0;color:#334155;font-size:13px;font-weight:800}',
      '.pagero-form-submit{width:100%;border:0;border-radius:18px;background:#101827;color:#fff;padding:16px;font:inherit;font-weight:900;cursor:pointer}',
      '.pagero-form-submit:disabled{opacity:.58;cursor:not-allowed}',
      '.pagero-form-notice{display:none;margin-top:14px;border-radius:14px;padding:13px 14px;font-weight:900;line-height:1.4}',
      '.pagero-form-notice.show{display:block}',
      '.pagero-form-notice.ok{background:#dcfce7;color:#047857}',
      '.pagero-form-notice.error{background:#fee2e2;color:#dc2626}',
      '.pagero-powered{display:block;margin:14px auto 0;text-align:center;color:#64748b;text-decoration:none;font-size:12px;font-weight:900}',
      '.pagero-powered:hover{color:#2563eb}'
    ].join('');
    document.head.appendChild(style);
  }

  function readCookie(name) {
    var parts = String(document.cookie || '').split(';');
    for (var i = 0; i < parts.length; i += 1) {
      var item = parts[i].trim();
      if (item.indexOf(name + '=') === 0) return decodeURIComponent(item.slice(name.length + 1));
    }
    return '';
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Max-Age=31536000; Path=/; SameSite=Lax';
  }

  function clientId() {
    try {
      var stored = localStorage.getItem(CLIENT_ID_KEY) || '';
      if (stored) return stored;
      stored = randomId('client');
      localStorage.setItem(CLIENT_ID_KEY, stored);
      return stored;
    } catch (e) {
      var cookie = readCookie(CLIENT_ID_KEY);
      if (cookie) return cookie;
      cookie = randomId('client');
      writeCookie(CLIENT_ID_KEY, cookie);
      return cookie;
    }
  }

  function isPhoneQuestion(q) {
    return !!q && (q.type === 'phone' || /\uC804\uD654|\uC5F0\uB77D|\uD734\uB300|\uD578\uB4DC|phone/i.test(String(q.label || '')));
  }

  function fieldMarkup(q) {
    q = q || {};
    var safeId = String(q.id || ('q_' + Math.random().toString(36).slice(2, 8)));
    var id = 'pagero-' + esc(safeId);
    var required = q.required ? ' required' : '';
    var label = esc(q.label || '\uC9C8\uBB38') + (q.required ? '<b>*</b>' : '');
    var placeholder = esc(q.placeholder || q.label || '');
    if (q.type === 'long') {
      return '<label class="pagero-form-field" for="' + id + '"><span>' + label + '</span><textarea id="' + id + '" name="' + esc(safeId) + '" placeholder="' + placeholder + '"' + required + '></textarea></label>';
    }
    if (q.type === 'select') {
      var selectOptions = (q.options && q.options.length ? q.options : ['\uC120\uD0DD 1', '\uC120\uD0DD 2']).map(function (option) {
        return '<option value="' + esc(option) + '">' + esc(option) + '</option>';
      }).join('');
      return '<label class="pagero-form-field" for="' + id + '"><span>' + label + '</span><select id="' + id + '" name="' + esc(safeId) + '"' + required + '><option value="">\uC120\uD0DD</option>' + selectOptions + '</select></label>';
    }
    if (q.type === 'multi') {
      var checks = (q.options && q.options.length ? q.options : ['\uC120\uD0DD 1', '\uC120\uD0DD 2']).map(function (option, index) {
        return '<label><input type="checkbox" name="' + esc(safeId) + '" value="' + esc(option) + '"' + (index === 0 && q.required ? ' data-required-group="1"' : '') + '>' + esc(option) + '</label>';
      }).join('');
      return '<fieldset class="pagero-form-field pagero-form-checks"><legend>' + label + '</legend>' + checks + '</fieldset>';
    }
    var inputType = q.type === 'email' ? 'email' : isPhoneQuestion(q) ? 'tel' : 'text';
    var phoneAttrs = isPhoneQuestion(q) ? ' inputmode="numeric" pattern="[0-9]*" data-pagero-phone="1" autocomplete="tel"' : '';
    return '<label class="pagero-form-field" for="' + id + '"><span>' + label + '</span><input id="' + id + '" type="' + inputType + '" name="' + esc(safeId) + '" placeholder="' + placeholder + '"' + phoneAttrs + required + '></label>';
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
    var labels = { direct: '\uC9C1\uC811 \uC720\uC785', referral: '\uC678\uBD80 \uB9C1\uD06C', naver: '\uB124\uC774\uBC84', google: '\uAD6C\uAE00', kakao: '\uCE74\uCE74\uC624', instagram: '\uC778\uC2A4\uD0C0\uADF8\uB7A8', meta: '\uD398\uC774\uC2A4\uBD81/\uBA54\uD0C0', youtube: '\uC720\uD29C\uBE0C' };
    return {
      channel: channel,
      utmSource: utmSource,
      utmMedium: utmMedium,
      utmCampaign: utmCampaign,
      sourceUrl: location.href,
      referrer: referrer,
      sourceLabel: (labels[channel] || channel || '\uC9C1\uC811 \uC720\uC785') + (utmCampaign ? ' \u00B7 ' + utmCampaign : '')
    };
  }

  function valuesFromForm(form, questions) {
    var data = new FormData(form);
    var values = {};
    var answers = [];
    questions.forEach(function (q) {
      var value = q.type === 'multi' ? data.getAll(q.id).filter(Boolean) : data.get(q.id);
      if (isPhoneQuestion(q)) value = digitsOnly(value);
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

  function readJsonSafe(res) {
    return res.text().then(function (raw) {
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch (e) {
        return {};
      }
    });
  }

  function submitErrorMessage(error) {
    var status = Number(error && error.status || 0);
    var code = String(error && error.code || '');
    if (status === 429 || code === 'LEAD_RATE_LIMITED') return '\uBC18\uBCF5 \uC811\uC218\uB85C \uC81C\uD55C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.';
    if (status === 409 || code.indexOf('DUPLICATE') >= 0) return '\uC774\uBBF8 \uC811\uC218\uB41C \uC815\uBCF4\uC785\uB2C8\uB2E4.';
    if (status === 404 || code === 'PUBLIC_PROJECT_NOT_FOUND') return '\uD398\uC774\uC9C0 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.';
    return '\uC811\uC218 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.';
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

  function normalizeFormConfig(block, page) {
    var s = block && block.s ? block.s : {};
    return {
      brand: '\uD398\uC774\uC9C0\uB85C',
      formId: block.id || '',
      title: s.title || '\uC0C1\uB2F4 \uC2E0\uCCAD',
      desc: s.desc || '',
      submit: s.submit || '\uC811\uC218\uD558\uAE30',
      success: s.success || '\uC811\uC218\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD655\uC778 \uD6C4 \uC5F0\uB77D\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4.',
      privacy: s.privacy || '\uAC1C\uC778\uC815\uBCF4 \uC218\uC9D1 \uBC0F \uC774\uC6A9\uC5D0 \uB3D9\uC758\uD569\uB2C8\uB2E4.',
      privacyRequired: s.privacyRequired !== false,
      page: { id: page.id || '', projectId: page.projectId || '', slug: page.slug || '', title: page.title || '' },
      project: { projectId: page.projectId || '', slug: page.slug || '' },
      questions: Array.isArray(s.questions) ? s.questions : []
    };
  }

  function findFormBlock(page, formId) {
    var blocks = Array.isArray(page && page.blocks) ? page.blocks : [];
    var forms = blocks.filter(function (block) {
      return block && block.visible !== false && block.type === 'form';
    });
    if (formId) {
      for (var i = 0; i < forms.length; i += 1) {
        if (String(forms[i].id || '') === String(formId)) return forms[i];
      }
    }
    return forms[0] || null;
  }

  function publicPageUrl(slug, projectId) {
    var query = '?public=1&fresh=' + Date.now();
    if (projectId) query += '&projectId=' + encodeURIComponent(projectId);
    return HOME_URL + '/api/pages/' + encodeURIComponent(slug) + query;
  }

  function publicPageFetchOptions() {
    return {
      cache: 'no-store'
    };
  }

  function fetchPublicPage(slug, projectId) {
    return fetch(publicPageUrl(slug, projectId), publicPageFetchOptions())
      .then(function (res) {
        if (res.ok) return res.json();
        if (projectId) {
          return fetch(publicPageUrl(slug, ''), publicPageFetchOptions())
            .then(function (fallbackRes) {
              if (!fallbackRes.ok) throw new Error('page ' + fallbackRes.status);
              return fallbackRes.json();
            });
        }
        throw new Error('page ' + res.status);
      });
  }

  function embedLoadError(code, message) {
    var error = new Error(message || code);
    error.code = code;
    return error;
  }

  function fetchPublicFormConfig(slug, formId, projectId) {
    return fetchPublicPage(slug, projectId)
      .then(function (data) {
        var page = data && data.page ? data.page : null;
        if (!page) throw embedLoadError('PAGE_NOT_FOUND', 'public page not found');
        var block = findFormBlock(page, formId);
        if (!block) throw embedLoadError('FORM_NOT_FOUND', 'form block not found');
        return normalizeFormConfig(block, page);
      });
  }

  function slugFromNode(node) {
    if (!node) return '';
    return node.getAttribute('data-pagero-page')
      || node.getAttribute('data-pagero-slug')
      || node.getAttribute('data-page-slug')
      || node.getAttribute('data-page')
      || node.getAttribute('data-slug')
      || node.getAttribute('data-pagero-form-embed')
      || '';
  }

  function formIdFromNode(node) {
    if (!node) return '';
    return node.getAttribute('data-pagero-form-id')
      || node.getAttribute('data-form-id')
      || node.getAttribute('data-form')
      || '';
  }

  function projectIdFromNode(node) {
    if (!node) return '';
    return node.getAttribute('data-pagero-project-id')
      || node.getAttribute('data-project-id')
      || node.getAttribute('data-project')
      || '';
  }

  function configFromScript(script) {
    if (script.getAttribute('data-pagero')) return Promise.resolve(decodeConfig(script.getAttribute('data-pagero')));
    var configId = script.getAttribute('data-config') || '';
    if (configId) {
      var configEl = document.getElementById(configId);
      return Promise.resolve(JSON.parse(configEl ? configEl.textContent || '{}' : '{}'));
    }
    var slug = slugFromNode(script);
    var formId = formIdFromNode(script);
    var projectId = projectIdFromNode(script);
    if (slug) return fetchPublicFormConfig(slug, formId, projectId);
    return Promise.reject(new Error('missing config'));
  }

  function configFromElement(el) {
    var slug = slugFromNode(el);
    var formId = formIdFromNode(el);
    var projectId = projectIdFromNode(el);
    if (slug) return fetchPublicFormConfig(slug, formId, projectId);
    if (el.getAttribute('data-pagero')) return Promise.resolve(decodeConfig(el.getAttribute('data-pagero')));
    return Promise.reject(new Error('missing config'));
  }

  function render(target, cfg) {
    css();
    cfg = cfg || {};
    cfg.questions = Array.isArray(cfg.questions) ? cfg.questions : [];
    target.innerHTML = '<div class="pagero-form-wrap"><form class="pagero-form-card" data-pagero-form><h2>' + esc(cfg.title || '\uC0C1\uB2F4 \uC2E0\uCCAD') + '</h2>' + (cfg.desc ? '<p>' + esc(cfg.desc) + '</p>' : '') + cfg.questions.map(fieldMarkup).join('') + (cfg.privacyRequired !== false ? '<label class="pagero-form-privacy"><input type="checkbox" name="privacy" required><span>' + esc(cfg.privacy || '\uAC1C\uC778\uC815\uBCF4 \uC218\uC9D1 \uBC0F \uC774\uC6A9\uC5D0 \uB3D9\uC758\uD569\uB2C8\uB2E4.') + '</span></label>' : '') + '<button class="pagero-form-submit" type="submit">' + esc(cfg.submit || '\uC811\uC218\uD558\uAE30') + '</button><div class="pagero-form-notice" data-pagero-notice></div></form><a class="pagero-powered" href="' + HOME_URL + '" target="_blank" rel="noopener">\uD398\uC774\uC9C0\uB85C\uB85C \uC81C\uC791</a></div>';

    var form = target.querySelector('[data-pagero-form]');
    var notice = target.querySelector('[data-pagero-notice]');
    var submit = form.querySelector('button[type="submit"]');
    function setNotice(message, type) {
      notice.textContent = message;
      notice.className = 'pagero-form-notice show ' + (type || 'ok');
    }

    form.addEventListener('input', function (event) {
      var input = event.target;
      if (!input || input.getAttribute('data-pagero-phone') !== '1') return;
      var next = digitsOnly(input.value);
      if (input.value !== next) input.value = next;
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit.disabled = true;
      var extracted = valuesFromForm(form, cfg.questions);
      var now = new Date().toISOString();
      var visitorId = clientId();
      var trafficInfo = traffic();
      var lead = Object.assign({
        id: randomId('embed'),
        type: '\uC0C1\uB2F4',
        kind: 'consult',
        formId: cfg.formId || '',
        pageSlug: (cfg.page && cfg.page.slug) || (cfg.project && cfg.project.slug) || '',
        clientId: visitorId,
        source: 'embed',
        sourceBlockTitle: cfg.title || '',
        brand: cfg.brand || '\uD398\uC774\uC9C0\uB85C',
        name: firstAnswer(extracted.answers, ['name'], /\uC774\uB984|\uC131\uD568|name/i),
        phone: digitsOnly(firstAnswer(extracted.answers, ['phone'], /\uC804\uD654|\uC5F0\uB77D|\uD734\uB300|\uD578\uB4DC|phone/i)),
        email: firstAnswer(extracted.answers, ['email'], /\uBA54\uC77C|email/i),
        address: firstAnswer(extracted.answers, ['address'], /\uC8FC\uC18C|address/i),
        message: firstAnswer(extracted.answers, ['long'], /\uBB38\uC758|\uB0B4\uC6A9|\uBA54\uC2DC\uC9C0|message/i),
        values: Object.assign({}, extracted.values, {
          clientId: visitorId,
          sourceUrl: trafficInfo.sourceUrl || '',
          referrer: trafficInfo.referrer || '',
          utmSource: trafficInfo.utmSource || '',
          utmMedium: trafficInfo.utmMedium || '',
          utmCampaign: trafficInfo.utmCampaign || '',
          sourceLabel: trafficInfo.sourceLabel || ''
        }),
        answers: extracted.answers,
        createdAt: now,
        createdMonth: now.slice(0, 7)
      }, trafficInfo);
      var payload = {
        lead: lead,
        page: cfg.page || {},
        project: Object.assign({}, cfg.project || {}, {
          projectId: (cfg.project && cfg.project.projectId) || (cfg.page && cfg.page.projectId) || '',
          slug: (cfg.project && cfg.project.slug) || (cfg.page && cfg.page.slug) || ''
        })
      };
      if (!payload.project.slug) {
        setNotice('\uD398\uC774\uC9C0 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'error');
        submit.disabled = false;
        return;
      }
      postJson(API_URL, payload)
        .then(function (res) {
          return readJsonSafe(res).then(function (data) {
            if (res.ok) return data;
            var error = new Error('server ' + res.status);
            error.status = res.status;
            error.code = data && (data.code || data.reason || '');
            throw error;
          });
        })
        .then(function () {
          form.reset();
          setNotice(cfg.success || '\uC811\uC218\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'ok');
        })
        .catch(function (error) {
          setNotice(submitErrorMessage(error), 'error');
        })
        .finally(function () {
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

  function shouldInitScript(script) {
    return !!(script && (
      script.getAttribute('data-pagero')
      || script.getAttribute('data-config')
      || script.getAttribute('data-pagero-page')
      || script.getAttribute('data-pagero-slug')
      || script.getAttribute('data-page-slug')
      || script.getAttribute('data-pagero-project-id')
      || script.getAttribute('data-page')
      || script.getAttribute('data-slug')
      || script.getAttribute('data-form')
      || script.getAttribute('data-target')
    ));
  }

  function init(script) {
    if (!shouldInitScript(script)) return;
    var target = targetForScript(script);
    if (!target) return;
    target.textContent = '\uC785\uB825\uD3FC\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.';
    configFromScript(script).then(function (config) {
      render(target, config);
    }).catch(function (error) {
      console.warn('Pagero form embed failed:', error && (error.code || error.message || error));
      target.textContent = '\uD398\uC774\uC9C0\uB85C \uC785\uB825\uD3FC\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.';
    });
  }

  function initElement(el) {
    if (!el || el.getAttribute('data-pagero-loaded') === '1') return;
    el.setAttribute('data-pagero-loaded', '1');
    el.textContent = '\uC785\uB825\uD3FC\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.';
    configFromElement(el).then(function (config) {
      render(el, config);
    }).catch(function (error) {
      console.warn('Pagero form embed failed:', error && (error.code || error.message || error));
      el.textContent = '\uD398\uC774\uC9C0\uB85C \uC785\uB825\uD3FC\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.';
    });
  }

  function initAll() {
    var scripts = document.querySelectorAll(SCRIPT_SELECTOR);
    for (var i = 0; i < scripts.length; i += 1) {
      if (shouldInitScript(scripts[i])) init(scripts[i]);
    }
    var targets = document.querySelectorAll('[data-pagero-page], [data-pagero-slug], [data-page-slug], [data-pagero-project-id], [data-pagero-form-embed]');
    for (var j = 0; j < targets.length; j += 1) initElement(targets[j]);
  }

  if (shouldInitScript(document.currentScript)) init(document.currentScript);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
}());
