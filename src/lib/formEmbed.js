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

function encodeConfig(value = {}) {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  return encodeURIComponent(json);
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

function inlineConfig(form = {}, page = {}) {
  const safePage = normalizePage(page);
  return {
    brand: '페이지로',
    formId: safeText(form.blockId || form.id || form.formId || ''),
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
}

export function generateStandaloneFormHtml(form = {}, page = {}) {
  const safePage = normalizePage(page);
  const formId = safeText(form.blockId || form.id || form.formId || '');
  if (safePage.slug && formId) {
    const projectAttr = safePage.projectId ? ` data-pagero-project-id="${escapeHtml(safePage.projectId)}"` : '';
    return `<script src="${DEFAULT_EMBED_SCRIPT_URL}" data-pagero-page="${escapeHtml(safePage.slug)}" data-pagero-form-id="${escapeHtml(formId)}"${projectAttr} defer></script>`;
  }
  return `<script src="${DEFAULT_EMBED_SCRIPT_URL}" data-pagero="${escapeHtml(encodeConfig(inlineConfig(form, page)))}" defer></script>`;
}
