import { useEffect, useMemo, useState } from 'react';
import { isServerPageMode } from '../../config/runtimeConfig.js';
import { postJson, projectAuthHeaders } from '../../lib/apiClient.js';
import {
  applyPageDomainConfig,
  normalizePageDomainConfig,
  pageDomainIssues,
} from '../../lib/pageDomains.js';
import { projectContext } from '../../lib/projectContext.js';
import { notify } from '../../lib/uiFeedback.js';

export default function usePageDomainSettings({
  authUser,
  disabled = false,
  onSavePage,
  page,
  updatePage,
}) {
  const [draft, setDraft] = useState(() => normalizePageDomainConfig(page));
  const [saving, setSaving] = useState(false);
  const [dns, setDns] = useState(null);

  useEffect(() => {
    if (saving) return;
    setDraft(normalizePageDomainConfig(page));
  }, [
    page.domainType,
    page.customDomain,
    page.domainStatus,
    page.sslStatus,
    page.domainFailureReason,
    page.domainLastCheckedAt,
    page.slug,
    page.url,
    saving,
  ]);

  const issues = useMemo(() => pageDomainIssues(draft), [draft]);

  const setDomainType = (domainType) => {
    setDns(null);
    setDraft((current) => normalizePageDomainConfig({
      ...current,
      domainType: domainType === 'custom' ? 'custom' : 'default',
      customDomain: domainType === 'custom' ? current.customDomain : '',
      domainStatus: domainType === 'custom' ? 'pending' : 'ready',
      sslStatus: domainType === 'custom' ? 'pending' : 'not_applicable',
    }));
  };

  const setCustomDomain = (customDomain) => {
    setDns(null);
    setDraft((current) => ({
      ...current,
      domainType: 'custom',
      customDomain,
      domainStatus: 'pending',
      sslStatus: 'pending',
      domainFailureReason: '',
    }));
  };

  const checkDomain = async () => {
    if (draft.domainType !== 'custom') return { ok: true, domainStatus: 'ready', sslStatus: 'not_applicable' };
    if (issues.length) return { ok: false, message: issues[0] };
    if (!isServerPageMode()) {
      return { ok: true, domainStatus: 'pending', sslStatus: 'pending', dns: null };
    }

    const context = projectContext(page, authUser);
    return postJson('/api/domains/check', {
      customDomain: draft.customDomain,
      pageId: page.id || '',
      projectId: context.projectId,
      ownerId: context.ownerId,
      slug: page.slug || '',
      project: context,
    }, { headers: projectAuthHeaders(context) });
  };

  const saveDomain = async () => {
    if (disabled || saving) return { ok: false };
    if (issues.length) {
      notify(issues[0], 'error');
      return { ok: false, message: issues[0] };
    }

    setSaving(true);
    try {
      const check = await checkDomain();
      if (check && check.ok === false) {
        notify(check.message || '도메인을 사용할 수 없습니다.', 'error');
        return check;
      }
      setDns(check?.dns || null);

      const nextPage = applyPageDomainConfig(page, {
        ...draft,
        customDomain: check?.customDomain || draft.customDomain,
        domainStatus: check?.domainStatus || (draft.domainType === 'custom' ? 'pending' : 'ready'),
        sslStatus: check?.sslStatus || (draft.domainType === 'custom' ? 'pending' : 'not_applicable'),
      });
      const result = await onSavePage?.(nextPage);
      if (result && result.ok === false) {
        notify(result.message || '도메인 설정을 저장하지 못했습니다.', 'error');
        return result;
      }

      const savedPage = result?.page || nextPage;
      const savedDomain = normalizePageDomainConfig(savedPage);
      updatePage(savedDomain);
      setDraft(savedDomain);
      notify(
        savedDomain.domainType === 'custom'
          ? '개인 도메인을 저장했습니다. DNS 연결 후 자동 확인됩니다.'
          : '페이지로 기본 주소로 변경했습니다.',
        'success',
      );
      return { ok: true, page: savedPage };
    } catch (error) {
      const message = error?.message || '도메인 설정을 저장하지 못했습니다.';
      notify(message, 'error');
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  };

  return {
    disabled,
    dns,
    draft,
    issues,
    saveDomain,
    saving,
    setCustomDomain,
    setDomainType,
  };
}
