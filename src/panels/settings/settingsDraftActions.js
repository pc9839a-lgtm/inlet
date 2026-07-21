import { sanitizePageSlug } from '../../lib/pageSlugs.js';
import { notify } from '../../lib/uiFeedback.js';
import { createBasicDraft } from './settingsDraftModel.js';

export async function persistBasicDraft({
  basicDraft,
  basicSourceRef,
  lockSection,
  onCheckUrl,
  onSavePage,
  page,
  setBasicDraft,
  updatePage,
}) {
  const currentBasic = createBasicDraft(page);
  const slug = sanitizePageSlug(basicDraft.slug, page.slug || 'my-page');
  let finalSlug = slug;
  const title = basicDraft.title || '';

  if (slug !== currentBasic.slug) {
    const check = await onCheckUrl?.({ slug });
    if (check && !check.ok) {
      setBasicDraft(currentBasic);
      basicSourceRef.current = currentBasic;
      notify(check.message || '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.', 'error');
      return;
    }
    finalSlug = sanitizePageSlug(check?.slug || slug, slug);
  }

  const nextPage = { ...page, title, slug: finalSlug, __explicitSlug: true };
  const result = await onSavePage?.(nextPage);
  if (result && result.ok === false) {
    setBasicDraft(currentBasic);
    basicSourceRef.current = currentBasic;
    return;
  }

  if (!result?.page) updatePage({ title, slug: finalSlug });
  const savedBasic = {
    title: result?.page?.title || title,
    slug: result?.page?.slug || finalSlug,
  };
  basicSourceRef.current = savedBasic;
  setBasicDraft(savedBasic);
  lockSection('basic');
  notify('페이지 기본 설정을 저장했습니다.', 'success');
}

export async function persistSeoDraft({ lockSection, onSavePage, page, seoDraft, updateMeta }) {
  const nextPage = { ...page, meta: { ...(page.meta || {}), ...seoDraft } };
  const result = await onSavePage?.(nextPage);
  if (result && result.ok === false) return;
  if (!result?.page) updateMeta(seoDraft);
  lockSection('seo');
  notify('SEO 설정을 저장했습니다.', 'success');
}

export function persistTrackingDraft({ lockSection, trackingDraft, updateMeta }) {
  updateMeta(trackingDraft);
  lockSection('tracking');
  notify('추적 코드 설정을 저장했습니다.', 'success');
}

export function updateConversionDraft({ patch, setConversionLocked, updateMeta }) {
  setConversionLocked(false);
  updateMeta(patch);
}

export function persistConversionValues({ hasConversionValue, setConversionLocked }) {
  if (!hasConversionValue) {
    notify('전환 추적 값을 하나 이상 입력하세요.', 'error');
    return;
  }
  setConversionLocked(true);
  notify('전환 추적 값을 저장했습니다.', 'success');
}