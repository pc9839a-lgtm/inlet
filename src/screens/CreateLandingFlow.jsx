import React, { Suspense, useEffect, useRef, useState } from 'react';
import { authAccountErrorMessage } from '../lib/authAccounts.js';
import { pageSlugIssues, sanitizePageSlug } from '../lib/pageSlugs.js';

function TemplatePanelSlot({ Component, page, templates, onApply }) {
  if (!Component) return null;
  return (
    <Suspense fallback={<div className="template-panel-loading" />}>
      <Component page={page} templates={templates} onApply={onApply} />
    </Suspense>
  );
}

function Dashboard({ user, page, leads, onCreate, onEdit, onPreview, onLogout, onAccountUpdate, onAi, onManual, onTemplate, onCheckUrl, templates = [], TemplatesPanelComponent = null }) {
  const hasPage = !!page?.title;
  const leadCount = Array.isArray(leads) ? leads.length : 0;
  const [createOpen, setCreateOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountDraft, setAccountDraft] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const openCreate = () => setCreateOpen(true);
  const accountName = user?.name || user?.email || '사용자';
  const accountMode = user?.accessMode || user?.role || 'master';
  const modeLabel = accountMode === 'manager' ? '매니저' : accountMode === 'clientAdmin' ? '클라이언트 관리자' : '마스터';
  const aiStatus = page?.ai?.lastTestStatus || 'idle';
  const aiCostLabel = aiStatus === 'success' || aiStatus === 'saved' ? '고객 키 확인됨' : '요청 시 고객 키';
  const setAccountField = (key, value) => {
    setAccountError('');
    setAccountDraft((current) => ({ ...current, [key]: value }));
  };
  const saveAccount = async (event) => {
    event.preventDefault();
    if (!onAccountUpdate) return;
    setAccountSaving(true);
    setAccountError('');
    try {
      await onAccountUpdate(accountDraft);
      setAccountOpen(false);
    } catch (err) {
      setAccountError(authAccountErrorMessage(err));
    } finally {
      setAccountSaving(false);
    }
  };

  useEffect(() => {
    setAccountDraft({ name: user?.name || '', phone: user?.phone || '' });
  }, [user?.name, user?.phone]);

  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="home-brand">
          <strong>페이지로</strong>
          <span>랜딩 관리</span>
        </div>

        <div className="home-user home-account-card">
          <div className="home-account-avatar" aria-hidden="true">{String(accountName).slice(0, 1).toUpperCase()}</div>
          <div className="home-account-meta">
            <strong>{accountName}</strong>
            <span>{user?.email || '이메일 없음'}</span>
          </div>
          <em>{modeLabel}</em>
          <button type="button" onClick={() => setAccountOpen((open) => !open)}>{accountOpen ? '닫기' : '계정'}</button>
          <button type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero home-dashboard-hero">
          <div>
            <span>고객 접수 랜딩 빌더</span>
            <h1>랜딩페이지를 만들고<br/>접수와 통계를 관리하세요.</h1>
            <p>페이지 제작, 접수함, 통계, 설정을 한 화면에서 관리합니다.</p>
          </div>

          <button type="button" onClick={openCreate}>새 랜딩 만들기</button>
        </section>

        <section className="home-account-summary" aria-label="계정 상태">
          <div>
            <span>계정</span>
            <strong>{user?.email || '이메일 없음'}</strong>
          </div>
          <div>
            <span>휴대폰</span>
            <strong>{user?.phone || '미등록'}</strong>
          </div>
          <div>
            <span>권한</span>
            <strong>{modeLabel}</strong>
          </div>
          <div>
            <span>AI 비용</span>
            <strong>{aiCostLabel}</strong>
          </div>
        </section>

        {accountOpen && (
          <section className="home-section home-account-edit">
            <div className="home-section-title">
              <h2>계정 설정</h2>
              <button type="button" onClick={() => setAccountOpen(false)}>닫기</button>
            </div>
            <form className="home-account-form" onSubmit={saveAccount}>
              <label>
                <span>이름</span>
                <input value={accountDraft.name} onChange={(event) => setAccountField('name', event.target.value)} placeholder="이름" />
              </label>
              <label>
                <span>이메일</span>
                <input value={user?.email || ''} disabled placeholder="email@example.com" />
              </label>
              <label>
                <span>휴대폰</span>
                <input type="tel" inputMode="tel" value={accountDraft.phone} onChange={(event) => setAccountField('phone', event.target.value)} placeholder="01012345678" />
              </label>
              <p>비밀번호 변경은 로그인 화면의 이메일 인증 후 비밀번호 변경 흐름을 사용합니다. AI API 키는 기본적으로 저장하지 않고 생성 요청 시 고객 키를 사용합니다.</p>
              {accountError && <strong className="auth-error">{accountError}</strong>}
              <button type="submit" disabled={accountSaving}>{accountSaving ? '저장 중' : '저장'}</button>
            </form>
          </section>
        )}

        {createOpen && (
          <DashboardCreateFlow
            page={page}
            templates={templates}
            onAi={onAi}
            onManual={onManual}
            onTemplate={onTemplate}
            onCheckUrl={onCheckUrl}
            onClose={() => setCreateOpen(false)}
            TemplatesPanelComponent={TemplatesPanelComponent}
          />
        )}

        <section className="home-section">
          <div className="home-section-title">
            <h2>내 랜딩페이지</h2>
            <button type="button" onClick={openCreate}>+ 새로 만들기</button>
          </div>

          {hasPage ? (
            <article className="landing-card">
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
              <strong>아직 만든 랜딩페이지가 없습니다.</strong>
              <p>새 랜딩 만들기를 눌러 시작하세요.</p>
              <button type="button" onClick={openCreate}>새 랜딩 만들기</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
function DashboardCreateFlow({ page, templates = [], onAi, onManual, onTemplate, onCheckUrl, onClose, TemplatesPanelComponent = null }) {
  const [step, setStep] = useState('menu');
  const [pendingMode, setPendingMode] = useState('');
  const [confirmedUrl, setConfirmedUrl] = useState(null);
  const footerBlock = page?.blocks?.find((block) => block.type === 'footer');
  const [footer, setFooter] = useState({
    company: footerBlock?.s?.company || '',
    owner: footerBlock?.s?.owner || '',
    phone: footerBlock?.s?.phone || '',
    address: footerBlock?.s?.address || '',
  });
  const setFooterField = (key, value) => setFooter((current) => ({ ...current, [key]: value }));
  const startUrlStep = (mode) => {
    setPendingMode(mode);
    setConfirmedUrl(null);
    setStep('url');
  };
  const modeLabel = pendingMode === 'ai' ? 'AI 만들기' : pendingMode === 'manual' ? '직접 만들기' : pendingMode === 'template' ? '템플릿 만들기' : '';
  const withUrl = (payload = {}) => ({ ...payload, ...(confirmedUrl || {}) });

  return (
    <section className={`home-create-flow home-create-step-${step}`}>
      <div className="home-create-head">
        <div>
          <span>새 랜딩 만들기</span>
          <h2>{step === 'menu' ? '시작 방식을 선택하세요.' : step === 'url' ? 'URL을 먼저 확인합니다.' : step === 'ai' ? 'AI로 초안을 만듭니다.' : step === 'manual' ? '기본 정보만 넣고 시작합니다.' : '템플릿을 선택하세요.'}</h2>
          <p>{step === 'menu' ? '아래 3가지 방식 중 하나를 선택하면 이 화면에서 다음 단계가 바로 열립니다.' : '필요한 정보만 입력하고 다음 단계로 진행합니다.'}</p>
        </div>
        <button type="button" onClick={onClose}>닫기</button>
      </div>

      <div className="home-create-options">
        <button type="button" className={pendingMode === 'ai' ? 'active primary' : ''} onClick={() => startUrlStep('ai')}>
          <strong>AI 만들기</strong>
          <span>AI 설정과 초안 입력 화면으로 시작합니다.</span>
        </button>
        <button type="button" className={pendingMode === 'manual' ? 'active primary' : ''} onClick={() => startUrlStep('manual')}>
          <strong>직접 만들기</strong>
          <span>푸터 기본정보만 입력하고 바로 편집합니다.</span>
        </button>
        <button type="button" className={pendingMode === 'template' ? 'active primary' : ''} onClick={() => startUrlStep('template')}>
          <strong>템플릿 만들기</strong>
          <span>실제 예시 화면을 슬라이드로 보고 선택합니다.</span>
        </button>
      </div>

      {step === 'url' && (
        <UrlStartStep
          initialSlug={page?.slug || ''}
          modeLabel={modeLabel}
          onBack={() => setStep('menu')}
          onConfirm={(url) => {
            setConfirmedUrl(url);
            setStep(pendingMode || 'menu');
          }}
          onCheckUrl={onCheckUrl}
        />
      )}

      {step === 'ai' && (
        <div className="home-create-ai-panel">
          <AiStartBasics onStart={(input) => onAi?.(withUrl(input))}/>
        </div>
      )}

      {step === 'manual' && (
        <div className="home-create-footer-form">
          <label><span>상호명</span><input value={footer.company} onChange={(e) => setFooterField('company', e.target.value)} placeholder="예: 페이지로 상담센터" /></label>
          <label><span>대표자</span><input value={footer.owner} onChange={(e) => setFooterField('owner', e.target.value)} placeholder="예: 홍길동" /></label>
          <label><span>연락처</span><input value={footer.phone} onChange={(e) => setFooterField('phone', e.target.value)} placeholder="010-0000-0000" /></label>
          <label><span>주소</span><input value={footer.address} onChange={(e) => setFooterField('address', e.target.value)} placeholder="사업장 주소" /></label>
          <button type="button" onClick={() => onManual?.(withUrl(footer))}>직접 만들기 시작</button>
        </div>
      )}

      {step === 'template' && (
        <div className="home-create-template">
          <TemplatePanelSlot Component={TemplatesPanelComponent} page={page} templates={templates} onApply={(templateId) => onTemplate?.(templateId, confirmedUrl)} />
        </div>
      )}
    </section>
  );
}

function TemplateChoiceCard({ template, onSelect }) {
  const tagText = template.chips?.slice(0, 3).join(' · ');

  return (
    <button type="button" className="template-choice-card" onClick={() => onSelect?.(template.id)}>
      <div className="template-choice-topline">
        <strong>{template.name}</strong>
        {tagText && <em>{tagText}</em>}
      </div>
      <span>{template.summary}</span>
    </button>
  );
}

function AiStartBasics({ onStart }) {
  const [form, setForm] = useState({
    prompt: '',
    industry: '',
    serviceName: '',
    goal: '상담신청',
    contactMethod: '상담폼',
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="create-ai-basics">
      <div className="create-ai-basics-head">
        <strong>기본 정보 저장</strong>
        <p>API 키 없이도 제작 방향을 먼저 저장합니다. 이후 AI 설정에서 키를 연결하면 이 입력값으로 바로 초안을 만들 수 있습니다.</p>
      </div>

      <label className="wide">
        <span>만들고 싶은 페이지</span>
        <textarea value={form.prompt} onChange={(e)=>set('prompt', e.target.value)} placeholder="예: 부평 피부관리샵 첫 방문 예약 랜딩. 민감성 피부 상담, 예약폼이 필요해." />
      </label>
      <label>
        <span>업종/키워드</span>
        <input value={form.industry} onChange={(e)=>set('industry', e.target.value)} placeholder="예: 피부관리샵, 세무 상담" />
      </label>
      <label>
        <span>서비스명</span>
        <input value={form.serviceName} onChange={(e)=>set('serviceName', e.target.value)} placeholder="예: 바른케어" />
      </label>
      <label>
        <span>목적</span>
        <select value={form.goal} onChange={(e)=>set('goal', e.target.value)}>
          <option value="상담신청">상담신청</option>
          <option value="방문예약">방문예약</option>
          <option value="견적문의">견적문의</option>
          <option value="이벤트 신청">이벤트 신청</option>
          <option value="상품문의">상품문의</option>
        </select>
      </label>
      <label>
        <span>연락 방식</span>
        <select value={form.contactMethod} onChange={(e)=>set('contactMethod', e.target.value)}>
          <option value="상담폼">상담 폼</option>
          <option value="방문예약">방문 예약</option>
          <option value="전화">전화</option>
          <option value="카카오톡">카카오톡</option>
          <option value="상담폼+전화">상담 폼 + 전화</option>
        </select>
      </label>

      <button type="button" onClick={() => onStart?.({ ...form, inputMode: 'detail' })}>저장하고 AI 설정 열기</button>
    </div>
  );
}

function UrlStartStep({ initialSlug = '', modeLabel = '', onBack, onConfirm, onCheckUrl }) {
  const [slug, setSlug] = useState(() => sanitizePageSlug(initialSlug || '', ''));
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null);
  const issues = pageSlugIssues(slug);
  const canCheck = !issues.length && !checking;

  const check = async () => {
    if (issues.length) {
      setStatus({ tone: 'error', text: issues[0] });
      return;
    }
    setChecking(true);
    setStatus({ tone: 'info', text: '중복 여부를 확인하는 중입니다.' });
    try {
      const safeSlug = sanitizePageSlug(slug, '');
      const result = await onCheckUrl?.({ slug: safeSlug, allowCurrent: false });
      if (result?.ok) {
        setStatus({
          tone: result.warning ? 'info' : 'success',
          text: result.message || '사용 가능한 URL입니다.',
        });
        onConfirm?.({ slug: result.slug || safeSlug });
        return;
      }
      setStatus({ tone: 'error', text: result?.message || '이미 사용 중인 URL입니다.' });
    } catch (error) {
      setStatus({ tone: 'error', text: String(error?.message || error || 'URL 확인에 실패했습니다.') });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="create-step-panel create-url-step">
      <div className="create-modal-title">
        <span>URL 설정</span>
        <h2 id="create-landing-title">페이지 주소를 먼저 정합니다.</h2>
        <p>{modeLabel ? `${modeLabel} 전에 URL 중복 여부를 확인합니다.` : 'URL 중복 여부를 확인한 뒤 페이지를 만듭니다.'}</p>
      </div>
      <label className="create-url-field">
        <span>기본 도메인 URL</span>
        <div>
          <em>/</em>
          <input
            value={slug}
            onChange={(event) => {
              setSlug(sanitizePageSlug(event.target.value, ''));
              setStatus(null);
            }}
            placeholder="my-brand"
            autoComplete="off"
          />
        </div>
        <small>영문 소문자, 숫자, 하이픈만 사용합니다. 무료 사용자는 확정 후 기본 도메인 URL을 변경할 수 없습니다.</small>
      </label>
      {status && <p className={`create-url-status ${status.tone}`}>{status.text}</p>}
      <div className="create-url-actions">
        <button type="button" onClick={onBack}>이전</button>
        <button type="button" className="primary" disabled={!canCheck} onClick={check}>{checking ? '확인 중' : '중복 확인 후 계속'}</button>
      </div>
    </div>
  );
}

function CreateLandingModal({ page, onClose, onAi, onManual, onTemplate, onCheckUrl, templates = [], TemplatesPanelComponent = null, canCreateLanding = true, createLandingStatus = '' }) {
  return null;

  const [step, setStep] = useState('menu');
  const [pendingMode, setPendingMode] = useState('');
  const [confirmedUrl, setConfirmedUrl] = useState(null);
  const dialogRef = useRef(null);
  const [footer, setFooter] = useState({
    company: page?.blocks?.find((block) => block.type === 'footer')?.s?.company || '',
    owner: page?.blocks?.find((block) => block.type === 'footer')?.s?.owner || '',
    phone: page?.blocks?.find((block) => block.type === 'footer')?.s?.phone || '',
    address: page?.blocks?.find((block) => block.type === 'footer')?.s?.address || '',
  });
  const setFooterField = (key, value) => setFooter((current) => ({ ...current, [key]: value }));
  const startUrlStep = (mode) => {
    setPendingMode(mode);
    setConfirmedUrl(null);
    setStep('url');
  };
  const modeLabel = pendingMode === 'ai' ? 'AI 초안 생성' : pendingMode === 'manual' ? '직접 만들기' : pendingMode === 'template' ? '템플릿 선택' : '';
  const continueAfterUrl = (url) => {
    setConfirmedUrl(url);
    setStep(pendingMode || 'menu');
  };
  const withUrl = (payload = {}) => ({ ...payload, ...(confirmedUrl || {}) });

  useEffect(() => {
    const focusable = dialogRef.current?.querySelector?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus?.();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className={`create-modal create-flow-${step}`} role="dialog" aria-modal="true" aria-labelledby="create-landing-title">
        <button className="create-modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>

        {step !== 'menu' && (
          <button className="create-modal-back" type="button" onClick={() => setStep(step === 'url' ? 'menu' : 'url')}>← 이전</button>
        )}

        {step === 'menu' && (
          <>
            <div className="create-modal-title">
              <span>새 랜딩 만들기</span>
              <h2 id="create-landing-title">어떻게 시작할까요?</h2>
              <p>시작 방식만 먼저 고르고, 다음 화면에서 필요한 정보만 입력합니다.</p>
            </div>

            <div className="create-options create-mode-options">
              {!canCreateLanding && createLandingStatus && <p className="create-url-status error">{createLandingStatus}</p>}
              <button type="button" className="primary" disabled={!canCreateLanding} onClick={() => startUrlStep('ai')}>
                <strong>AI 만들기</strong>
                <span>AI 설정과 초안 입력 화면으로 시작합니다.</span>
              </button>

              <button type="button" disabled={!canCreateLanding} onClick={() => startUrlStep('manual')}>
                <strong>직접 만들기</strong>
                <span>푸터 기본정보만 입력하고 바로 편집합니다.</span>
              </button>

              <button type="button" disabled={!canCreateLanding} onClick={() => startUrlStep('template')}>
                <strong>템플릿 만들기</strong>
                <span>실제 예시 화면을 넘겨보고 선택합니다.</span>
              </button>
            </div>
          </>
        )}

        {step === 'url' && (
          <UrlStartStep
            initialSlug={page?.slug || ''}
            modeLabel={modeLabel}
            onBack={() => setStep('menu')}
            onConfirm={continueAfterUrl}
            onCheckUrl={onCheckUrl}
          />
        )}

        {step === 'ai' && (
          <div className="create-step-panel">
            <div className="create-modal-title">
              <span>AI 만들기</span>
              <h2 id="create-landing-title">기본 정보를 먼저 저장합니다.</h2>
              <p>API 키는 지금 입력하지 않습니다. 제작 방향만 저장하고 AI 설정 화면에서 나중에 연결합니다.</p>
            </div>
            <AiStartBasics onStart={(input) => onAi?.(withUrl(input))}/>
          </div>
        )}

        {step === 'manual' && (
          <div className="create-step-panel">
            <div className="create-modal-title">
              <span>직접 만들기</span>
              <h2 id="create-landing-title">기본 정보만 넣고 시작합니다.</h2>
              <p>푸터에 들어갈 최소 정보만 먼저 입력합니다. 나머지는 편집 화면에서 구성합니다.</p>
            </div>
            <div className="create-footer-form">
              <label><span>상호명</span><input value={footer.company} onChange={(e) => setFooterField('company', e.target.value)} placeholder="예: 페이지로 상담센터" /></label>
              <label><span>대표자</span><input value={footer.owner} onChange={(e) => setFooterField('owner', e.target.value)} placeholder="예: 홍길동" /></label>
              <label><span>연락처</span><input value={footer.phone} onChange={(e) => setFooterField('phone', e.target.value)} placeholder="010-0000-0000" /></label>
              <label><span>주소</span><input value={footer.address} onChange={(e) => setFooterField('address', e.target.value)} placeholder="사업장 주소" /></label>
              <button type="button" onClick={() => onManual?.(withUrl(footer))}>직접 만들기 시작</button>
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="create-template-step">
            <h2 id="create-landing-title" className="sr-only">템플릿을 선택하세요.</h2>
            <TemplatePanelSlot Component={TemplatesPanelComponent} page={page} templates={templates} onApply={(templateId) => onTemplate?.(templateId, confirmedUrl)} />
          </div>
        )}
      </section>
    </div>
  );
}

function StartModeOverlay({ onManual, onAi, onTemplate, onClose, templates = [] }) {
  return null;

  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const dismiss = (handler, value) => {
    setDismissed(true);
    handler?.(value);
  };

  return (
    <div className="start-mode-overlay">
      <div className="start-mode-card">
        <button type="button" className="start-mode-close" aria-label="시작 방식 선택 닫기" onClick={() => dismiss(onClose)}>
          ×
        </button>
        <div className="start-mode-title">
          <span>시작 방식 선택</span>
          <h2>처음 화면을 어떻게 만들까요?</h2>
          <p>AI 초안으로 빠르게 시작하거나, 직접 편집으로 바로 만들 수 있습니다.</p>
        </div>

        <div className="start-mode-actions">
          <button type="button" className="primary" onClick={() => dismiss(onAi, 'ai')}>
            <strong>AI 초안으로 시작</strong>
            <span>설정의 AI 생성 화면으로 이동해서 기본 화면을 먼저 만듭니다.</span>
          </button>
          <button type="button" onClick={() => dismiss(onManual, 'manual')}>
            <strong>직접 만들기</strong>
            <span>현재 편집 화면에서 바로 수동으로 구성합니다.</span>
          </button>
          <button type="button" onClick={() => dismiss(onTemplate, 'template')}>
            <strong>템플릿으로 시작</strong>
            <span>목적에 맞는 기본 화면을 먼저 만든 뒤 수정합니다.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { CreateLandingModal, StartModeOverlay };
