import { fetchPublicServerPage } from '../lib/pageRepository.js';

const PUBLIC_VERIFICATION_DEBOUNCE_MS = 700;
const PUBLIC_VERIFICATION_ATTEMPTS = 3;
const publicVerificationJobs = new Map();

function text(value) {
  return String(value || '').trim();
}

function pageSlug(page = {}) {
  return text(page.slug) || 'my-page';
}

function verificationKey(page = {}) {
  return `${text(page.projectId) || 'project'}:${pageSlug(page)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicPageMatchesSaved(publicPage = null, savedPage = {}) {
  if (!publicPage || !savedPage) return false;
  if (text(publicPage.slug) !== text(savedPage.slug)) return false;
  if (text(publicPage.projectId) !== text(savedPage.projectId)) return false;

  const publicRevision = Number(publicPage.revision || 0);
  const savedRevision = Number(savedPage.revision || 0);
  if (publicRevision <= 0 || savedRevision <= 0 || publicRevision !== savedRevision) return false;

  const publicUpdatedAt = text(publicPage.updatedAt || publicPage.savedAt);
  const savedUpdatedAt = text(savedPage.updatedAt || savedPage.savedAt);
  if (publicUpdatedAt && savedUpdatedAt && publicUpdatedAt !== savedUpdatedAt) return false;
  return true;
}

function finishVerification(job, nextState = {}) {
  if (!job || job.settled) return job?.state || null;
  job.settled = true;
  Object.assign(job.state, nextState, { pending: false });
  job.resolve(job.state);
  if (publicVerificationJobs.get(job.key) === job) publicVerificationJobs.delete(job.key);
  return job.state;
}

async function verifyPublicPageSave(job, savedPage = {}) {
  let publicPage = null;
  for (let attempt = 0; attempt < PUBLIC_VERIFICATION_ATTEMPTS; attempt += 1) {
    if (job.settled) return job.state;
    try {
      publicPage = await fetchPublicServerPage(pageSlug(savedPage));
    } catch (error) {
      if (attempt === PUBLIC_VERIFICATION_ATTEMPTS - 1) {
        return finishVerification(job, {
          ok: false,
          errorCode: 'PAGE_PUBLIC_VERIFY_FAILED',
          message: String(error?.message || '공개 페이지 반영을 확인하지 못했습니다.'),
        });
      }
    }

    if (job.settled) return job.state;
    if (publicPageMatchesSaved(publicPage, savedPage)) {
      return finishVerification(job, {
        ok: true,
        publicRevision: Number(publicPage.revision || 0),
        publicUpdatedAt: text(publicPage.updatedAt || publicPage.savedAt),
      });
    }
    if (attempt < PUBLIC_VERIFICATION_ATTEMPTS - 1) await sleep(250 * (attempt + 1));
  }

  return finishVerification(job, {
    ok: false,
    errorCode: 'PAGE_PUBLIC_VERIFY_FAILED',
    message: publicPage
      ? '서버에는 저장됐지만 공개 URL의 최신 반영을 확인하지 못했습니다.'
      : '서버에는 저장됐지만 공개 URL에서 저장한 페이지를 확인하지 못했습니다.',
    savedRevision: Number(savedPage.revision || 0),
    publicRevision: Number(publicPage?.revision || 0),
    savedUpdatedAt: text(savedPage.updatedAt || savedPage.savedAt),
    publicUpdatedAt: text(publicPage?.updatedAt || publicPage?.savedAt),
  });
}

export function schedulePublicPageSaveVerification(savedPage = {}, enabled = true) {
  if (!enabled || !savedPage?.slug || !savedPage?.revision) {
    return { ok: true, skipped: true, pending: false };
  }

  const key = verificationKey(savedPage);
  const previousJob = publicVerificationJobs.get(key);
  if (previousJob) {
    if (previousJob.timer) clearTimeout(previousJob.timer);
    finishVerification(previousJob, {
      ok: true,
      skipped: true,
      superseded: true,
      reason: 'newer-save',
    });
  }

  let resolveCompletion = () => {};
  const state = {
    ok: null,
    skipped: false,
    pending: true,
    debounceMs: PUBLIC_VERIFICATION_DEBOUNCE_MS,
    completion: null,
  };
  state.completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  const job = {
    key,
    state,
    resolve: resolveCompletion,
    timer: null,
    settled: false,
  };
  job.timer = setTimeout(() => {
    job.timer = null;
    verifyPublicPageSave(job, savedPage).catch((error) => {
      finishVerification(job, {
        ok: false,
        errorCode: 'PAGE_PUBLIC_VERIFY_FAILED',
        message: String(error?.message || '공개 페이지 반영을 확인하지 못했습니다.'),
      });
    });
  }, PUBLIC_VERIFICATION_DEBOUNCE_MS);

  publicVerificationJobs.set(key, job);
  return state;
}

export function attachPublicPageSaveVerification(result = null) {
  if (!result || result.mode === 'local' || result.replayed || !result.page) return result;
  return {
    ...result,
    publicVerification: schedulePublicPageSaveVerification(result.page, true),
  };
}
