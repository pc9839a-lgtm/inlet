import { useState } from 'react';
import { normalizePageDuplicateUrl, pageDuplicateUrlIssues, sanitizeDuplicateSlug } from '../../lib/pageDuplication.js';
import { notify } from '../../lib/uiFeedback.js';

export default function usePageDuplicateSettings({
  canDuplicatePage,
  onDuplicatePage,
  page,
}) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateDraft, setDuplicateDraft] = useState(() => normalizePageDuplicateUrl({
    domainType: 'default',
    slug: `${sanitizeDuplicateSlug(page.slug || 'my-page') || 'my-page'}-copy`,
  }));

  const setDuplicateField = (key, value) => {
    setDuplicateDraft((draft) => normalizePageDuplicateUrl({ ...draft, [key]: value }));
  };

  const duplicateIssues = pageDuplicateUrlIssues(duplicateDraft, page);
  const duplicateBlocked = duplicateIssues.length > 0 || !canDuplicatePage;

  const requestPageDuplicate = () => {
    if (!canDuplicatePage) {
      notify('페이지 복제는 유료 기능입니다. 결제 연동 후 사용할 수 있습니다.', 'warning');
      return;
    }
    if (duplicateIssues.length) {
      notify(duplicateIssues[0], 'error');
      return;
    }
    const result = onDuplicatePage?.(duplicateDraft);
    if (result?.ok) setDuplicateOpen(false);
    if (result && !result.ok) notify(result.message || '페이지 복제를 진행할 수 없습니다.', result.locked ? 'warning' : 'error');
  };

  return {
    duplicateBlocked,
    duplicateDraft,
    duplicateIssues,
    duplicateOpen,
    requestPageDuplicate,
    setDuplicateField,
    setDuplicateOpen,
  };
}
