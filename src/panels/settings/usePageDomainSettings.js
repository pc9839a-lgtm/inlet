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
  const [checking, setChecking] = useState(false);
  const [dns, setDns] = useState(null);

  useEffect(() => {
    if (saving || checking) return;
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
    checking,
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

  const domainRequest = async (action, sourcePage, customDomain = '') => {
    if (!isServerPageMode()) return null;
    const context = projectContext(sourcePage || page, authUser);
    return postJson('/api/domains/manage', {
      action,
      customDomain,
      pageId: sourcePage?.id || page.id || '',
      projectId: context.projectId,
      ownerId: context.ownerId,
      slug: sourcePage?.slug || page.slug || '',
      project: context,
    }, { headers: projectAuthHeaders(context) });
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

  const applyManagedState = (basePage, managed) => {
    const current = managed?.current;
    if (!current) return basePage;
    const nextPage = applyPageDomainConfig(basePage, current);
    const nextDomain = normalizePageDomainConfig(nextPage);
    updatePage(nextDomain);
    setDraft(nextDomain);
    setDns(managed?.dns ? { ...managed.dns, validation: current.validation || null } : null);
    return nextPage;
  };

  const verifyDomain = async () => {
    if (disabled || saving || checking || draft.domainType !== 'custom') return { ok: false };
    if (issues.length) {
      notify(issues[0], 'error');
      return { ok: false, message: issues[0] };
    }
    const saved = normalizePageDomainConfig(page);
    const requested = normalizePageDomainConfig({ domainType: 'custom', customDomain: draft.customDomain });
    if (!page.id || saved.domainType !== 'custom' || saved.customDomain !== requested.customDomain) {
      notify('도메인을 먼저 저장한 뒤 연결 상태를 확인해주세요.', 'error');
      return { ok: false };
    }

    setChecking(true);
    try {
      const managed = await domainRequest('verify', page, saved.customDomain);
      if (!managed) {
        notify('서버 모드에서 연결 상태를 확인할 수 있습니다.', 'error');
        return { ok: false };
      }
      applyManagedState(page, managed);
      notify(managed.message || '도메인 연결 상태를 확인했습니다.', managed.current?.domainStatus === 'failed' ? 'error' : 'success');
      return managed;
    } catch (error) {
      const message = error?.message || '도메인 연결 상태를 확인하지 못했습니다.';
      notify(message, 'error');
      return { ok: false, message };
    } finally {
      setChecking(false);
    }
  };

  const saveDomain = async () => {
    if (disabled || saving || checking) return { ok: false };
    if (issues.length) {
      notify(issues[0], 'error');
      return { ok: false, message: issues[0] };
    }

    setSaving(true);
    try {
      const previousDomain = normalizePageDomainConfig(page);
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

      let savedPage = result?.page || nextPage;
      let savedDomain = normalizePageDomainConfig(savedPage);
      updatePage(savedDomain);
      setDraft(savedDomain);

      if (isServerPageMode() && savedPage.id) {
        try {
          if (savedDomain.domainType === 'custom') {
            const managed = await domainRequest('verify', savedPage, savedDomain.customDomain);
            savedPage = applyManagedState(savedPage, managed);
            savedDomain = normalizePageDomainConfig(savedPage);
          } else if (previousDomain.domainType === 'custom' && previousDomain.customDomain) {
            await domainRequest('detach', savedPage, previousDomain.customDomain);
          }
        } catch {
          notify(
            savedDomain.domainType === 'custom'
              ? '도메인은 저장했지만 연결 확인을 완료하지 못했습니다. 상태 확인을 다시 눌러주세요.'
              : '기본 주소로 변경했지만 이전 도메인 해제 확인이 필요합니다.',
            'error',
          );
        }
      }

      notify(
        savedDomain.domainType === 'custom'
          ? (savedDomain.domainStatus === 'active'
            ? '개인 도메인 연결이 완료되었습니다.'
            : '개인 도메인을 저장했습니다. DNS와 SSL 연결 상태를 확인 중입니다.')
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
    checking,
    disabled,
    dns,
    draft,
    issues,
    saveDomain,
    saving,
    setCustomDomain,
    setDomainType,
    verifyDomain,
  };
}
