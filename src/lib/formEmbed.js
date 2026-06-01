const DEFAULT_EMBED_SCRIPT_URL = 'https://pagero.kr/embed/form.js';

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

export function generateStandaloneFormHtml(form = {}, page = {}) {
  const safePage = normalizePage(page);
  const embedId = `pagero-form-${safeText(form.id || form.blockId || Math.random().toString(36).slice(2, 8)).replace(/[^a-zA-Z0-9_-]/g, '') || 'main'}`;
  const configId = `${embedId}-config`;
  const config = {
    brand: '페이지로',
    formId: safeText(form.id || form.blockId || ''),
    title: safeText(form.title, '상담 신청'),
    desc: safeText(form.desc || ''),
    submit: safeText(form.submit, '접수하기'),
    success: safeText(form.success, '접수가 완료되었습니다. 확인 후 연락드리겠습니다.'),
    privacy: safeText(form.privacy, '개인정보 수집 및 이용에 동의합니다.'),
    privacyRequired: form.privacyRequired !== false,
    page: safePage,
    project: {
      projectId: safePage.projectId,
      slug: safePage.slug,
    },
    questions: Array.isArray(form.questions) ? form.questions.map(normalizeQuestion) : [],
  };

  return `<div id="${escapeHtml(embedId)}"></div>
<script type="application/json" id="${escapeHtml(configId)}">${escapeHtml(JSON.stringify(config))}</script>
<script src="${DEFAULT_EMBED_SCRIPT_URL}" data-target="${escapeHtml(embedId)}" data-config="${escapeHtml(configId)}" defer></script>`;
}
