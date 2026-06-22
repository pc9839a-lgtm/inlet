import React, { useEffect, useState } from 'react';
import { authAccountErrorMessage } from '../lib/authAccounts.js';

function DashboardPolished({ user, page, leads, onCreate, onEdit, onPreview, onLogout, onAccountUpdate }) {
  const leadCount = Array.isArray(leads) ? leads.length : 0;
  const hasPage = !!page?.title;
  const [accountOpen, setAccountOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const accountName = user?.name || user?.email || '사용자';
  const accessMode = user?.accessMode || user?.role || 'master';
  const modeLabel = accessMode === 'manager' ? '매니저' : accessMode === 'clientAdmin' ? '관리자' : '마스터';
  const planLabel = user?.plan || page?.billing?.plan || '기본';

  useEffect(() => {
    setDraft({ name: user?.name || '', phone: user?.phone || '' });
  }, [user?.name, user?.phone]);

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

  return (
    <div className="home-shell service-home-shell">
      <header className="home-header service-home-header">
        <div className="home-brand service-brand">
          <strong>페이지로</strong>
          <span>랜딩 운영 콘솔</span>
        </div>
        <div className="service-header-actions">
          <span className="service-plan-badge">{planLabel}</span>
          <button type="button" onClick={() => setAccountOpen((open) => !open)}>{accountOpen ? '닫기' : '계정'}</button>
          <button type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className="home-main service-dashboard">
        <section className="service-dashboard-hero">
          <div>
            <span>PAGEGO</span>
            <h1>페이지로</h1>
            <p>랜딩 제작, 접수 확인, 통계를 한 화면에서 관리합니다.</p>
          </div>
          <button type="button" onClick={onCreate}>새 랜딩 만들기</button>
        </section>

        <section className="service-summary-grid">
          <article>
            <span>계정</span>
            <strong>{accountName}</strong>
            <small>{user?.email || '이메일 없음'}</small>
          </article>
          <article>
            <span>권한</span>
            <strong>{modeLabel}</strong>
            <small>{user?.phone || '연락처 없음'}</small>
          </article>
          <article>
            <span>랜딩</span>
            <strong>{hasPage ? '1개' : '없음'}</strong>
            <small>{page?.slug ? `/${page.slug}` : 'URL 미설정'}</small>
          </article>
          <article>
            <span>접수</span>
            <strong>{leadCount}건</strong>
            <small>최근 접수 기준</small>
          </article>
        </section>

        {accountOpen && (
          <section className="home-section service-account-edit">
            <div className="home-section-title">
              <h2>내 계정</h2>
            </div>
            <form className="home-account-form" onSubmit={saveAccount}>
              <label>
                <span>이름</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="이름" />
              </label>
              <label>
                <span>이메일</span>
                <input value={user?.email || ''} disabled />
              </label>
              <label>
                <span>연락처</span>
                <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="010-0000-0000" />
              </label>
              {error && <strong className="auth-error">{error}</strong>}
              <button type="submit" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
            </form>
          </section>
        )}

        <section className="home-section service-page-list">
          <div className="home-section-title">
            <h2>내 랜딩페이지</h2>
            <button type="button" onClick={onCreate}>새로 만들기</button>
          </div>
          {hasPage ? (
            <article className="landing-card service-landing-card">
              <div>
                <strong>{page.title || '랜딩페이지'}</strong>
                <span>/{page.slug || 'my-page'} · 접수 {leadCount}건</span>
              </div>
              <div className="landing-card-actions">
                <button type="button" onClick={onEdit}>편집</button>
                <button type="button" onClick={onPreview}>미리보기</button>
              </div>
            </article>
          ) : (
            <div className="empty-landing">
              <strong>랜딩페이지가 없습니다.</strong>
              <p>새 랜딩을 만들어 시작하세요.</p>
              <button type="button" onClick={onCreate}>새 랜딩 만들기</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default DashboardPolished;
export { DashboardPolished };
