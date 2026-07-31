import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { rememberAccountProjectAccess } from '../lib/accountProjectAccess.js';
import { authAccountErrorMessage } from '../lib/authAccounts.js';
import { deleteAccountPage, fetchAccountPages } from '../lib/pageRepository.js';
import { canCreateLandingPage, isPlatformMasterUser } from '../lib/platformAccountPolicy.js';
import { WorkspaceCreateModalLayer } from './workspace/WorkspaceCreateModalLayer.jsx';
import './DashboardAccountLimit.css';

function DashboardPolished({ user, page, leads, onEdit, onLogout, onAccountUpdate, onAi, onManual, onTemplate, onCheckUrl, templates = [] }) {
  const currentLeadCount = Array.isArray(leads) ? leads.length : 0;
  const hasCurrentPage = Boolean(page?.title || page?.slug);
  const [accountOpen, setAccountOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accountPages, setAccountPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [pageListError, setPageListError] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState('');
  const [draft, setDraft] = useState({ name: user?.name || '', phone: user?.phone || '' });

  const accountName = user?.name || user?.email || '사용자';
  const accessMode = user?.accessMode || user?.role || 'master';
  const modeLabel = accessMode === 'manager' ? '매니저' : accessMode === 'clientAdmin' ? '관리자' : '마스터';
  const planLabel = user?.plan || page?.billing?.plan || '기본';
  const platformMaster = isPlatformMasterUser(user);

  useEffect(() => {
    setDraft({ name: user?.name || '', phone: user?.phone || '' });
  }, [user?.name, user?.phone]);

  useEffect(() => {
    let alive = true;
    setPagesLoading(true);
    setPagesLoaded(false);
    setAccountPages([]);
    fetchAccountPages(user)
      .then((pages) => {
        if (alive) {
          setAccountPages(pages);
          setPagesLoaded(true);
          setPageListError('');
        }
      })
      .catch((loadError) => {
        console.warn('Account page list load failed:', loadError);
        if (alive) setPageListError('페이지 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (alive) setPagesLoading(false);
      });
    return () => { alive = false; };
  }, [user?.session]);

  const visiblePages = useMemo(() => {
    if (user?.session) return accountPages;
    if (pagesLoaded) return accountPages;
    return hasCurrentPage ? [{ ...page, leadCount: currentLeadCount }] : [];
  }, [accountPages, currentLeadCount, hasCurrentPage, page, pagesLoaded, user?.session]);

  const totalLeadCount = visiblePages.reduce((sum, item) => sum + Number(item.leadCount || 0), 0);
  const pageCountReady = !user?.session || pagesLoaded;
  const createCheckPending = !platformMaster && !pageCountReady;
  const createLimitReached = pageCountReady && !canCreateLandingPage(user, visiblePages.length);
  const createDisabled = createCheckPending || createLimitReached;

  const openCreate = () => {
    if (createDisabled) return;
    setCreateOpen(true);
  };

  const createButtonLabel = createCheckPending
    ? '확인 중'
    : createLimitReached
      ? '랜딩 1개 사용 중'
      : '새 랜딩 만들기';

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!onAccountUpdate) return;
    setSaving(true);
    setError('');
    try {
      await onAccountUpdate(draft);
      setAccountOpen(false);
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (item) => {
    rememberAccountProjectAccess(item);
    if (typeof onEdit === 'function') {
      onEdit({ ...item, __accountProjectAccess: true });
      return;
    }
    window.location.href = `/app?slug=${encodeURIComponent(item.slug || '')}`;
  };

  const openPreview = (item) => {
    window.location.href = `/${item.slug}`;
  };

  const deletePage = async (item) => {
    const title = item.title || item.slug || '이 페이지';
    if (!window.confirm(`"${title}" 페이지를 삭제할까요?\n삭제하면 공개 주소에서도 보이지 않습니다.`)) return;
    const deleteKey = item.projectId || item.id || item.slug;
    setDeletingProjectId(deleteKey);
    setPageListError('');
    try {
      await deleteAccountPage(item, user);
      setAccountPages((current) => current.filter((candidate) => (
        (candidate.projectId || candidate.id || candidate.slug) !== deleteKey
      )));
      setPagesLoaded(true);
    } catch (deleteError) {
      console.warn('Account page delete failed:', deleteError);
      setPageListError(deleteError?.message || '페이지를 삭제하지 못했습니다.');
    } finally {
      setDeletingProjectId('');
    }
  };

  return (
    <div className="home-shell service-home-shell">
      <header className="home-header service-home-header">
        <div className="home-brand service-brand">
          <strong>페이지로</strong>
          <span>랜딩 운영 콘솔</span>
        </div>
        <div className="service-header-actions">
          <span className="service-plan-badge">{planLabel}</span>
          <button className="ghost-btn" type="button" onClick={() => setAccountOpen((open) => !open)}>
            {accountOpen ? '닫기' : '계정'}
          </button>
          <button className="ghost-btn" type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className="home-main service-dashboard">
        <section className="service-dashboard-hero">
          <div>
            <span>PAGERO</span>
            <h1>페이지로</h1>
            <p>랜딩 제작, 접수 확인, 통계를 한 화면에서 관리합니다.</p>
          </div>
          <button className="primary-btn" type="button" disabled={createDisabled} onClick={openCreate}>{createButtonLabel}</button>
        </section>

        <section className="service-summary-grid" aria-label="계정과 랜딩 상태">
          <article>
            <span>계정</span>
            <strong>{accountName}</strong>
            <small>{user?.email || '이메일 없음'}</small>
          </article>
          <article>
            <span>권한</span>
            <strong>{platformMaster ? '운영자' : modeLabel}</strong>
            <small>{user?.phone || '연락처 없음'}</small>
          </article>
          <article>
            <span>랜딩</span>
            <strong>{visiblePages.length ? `${visiblePages.length}개` : '없음'}</strong>
            <small>{visiblePages.length ? `/${visiblePages[0].slug}` : 'URL 미설정'}</small>
          </article>
          <article>
            <span>접수</span>
            <strong>{totalLeadCount}건</strong>
            <small>전체 랜딩 기준</small>
          </article>
        </section>

        {accountOpen && (
          <section className="home-section service-account-edit">
            <div className="home-section-title"><h2>계정 설정</h2></div>
            <form className="home-account-form" onSubmit={saveAccount}>
              <label>
                <span>이름</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="이름" />
              </label>
              <label><span>이메일</span><input value={user?.email || ''} disabled /></label>
              <label>
                <span>연락처</span>
                <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="010-0000-0000" />
              </label>
              {error && <strong className="auth-error">{error}</strong>}
              <button className="primary-btn" type="submit" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
            </form>
          </section>
        )}

        <section className="home-section service-page-list" aria-busy={pagesLoading}>
          <div className="home-section-title">
            <h2>내 랜딩페이지</h2>
            <button className="primary-btn" type="button" disabled={createDisabled} onClick={openCreate}>{createButtonLabel}</button>
          </div>
          {createLimitReached && (
            <p className="service-create-limit-note">일반 계정은 랜딩페이지를 1개까지만 만들 수 있습니다.</p>
          )}
          {pageListError && <strong className="service-page-list-error" role="alert">{pageListError}</strong>}
          {visiblePages.length ? visiblePages.map((item) => (
            <article className="landing-card service-landing-card" key={`${item.projectId || ''}:${item.id || item.slug}`}>
              <div>
                <strong>{item.title || '랜딩페이지'}</strong>
                <span>/{item.slug} · 접수 {Number(item.leadCount || 0)}건</span>
              </div>
              <div className="landing-card-actions">
                <button className="primary-btn" type="button" onClick={() => openEditor(item)}>편집</button>
                <button className="ghost-btn" type="button" onClick={() => openPreview(item)}>미리보기</button>
                <button
                  className="danger-btn landing-delete-btn"
                  type="button"
                  disabled={deletingProjectId === (item.projectId || item.id || item.slug)}
                  onClick={() => deletePage(item)}
                >
                  {deletingProjectId === (item.projectId || item.id || item.slug) ? '삭제 중' : '삭제'}
                </button>
              </div>
            </article>
          )) : (
            <div className="empty-landing">
              <strong>랜딩페이지가 없습니다.</strong>
              <button className="primary-btn" type="button" disabled={createDisabled} onClick={openCreate}>{createButtonLabel}</button>
            </div>
          )}
        </section>
      </main>

      <Suspense fallback={null}>
        <WorkspaceCreateModalLayer
          show={createOpen && !createDisabled}
          page={page}
          onClose={() => setCreateOpen(false)}
          createWithAi={onAi}
          createManual={onManual}
          createFromTemplate={onTemplate}
          onCheckUrl={onCheckUrl}
          defaultSlug=""
          templates={templates}
        />
      </Suspense>
    </div>
  );
}

export default DashboardPolished;
export { DashboardPolished };
