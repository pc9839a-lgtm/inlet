import { useEffect, useMemo, useState } from 'react';
import { START_MODE_KEY } from '../config/storageKeys.js';
import { apiFetch, postJson, projectAuthHeaders } from '../lib/apiClient.js';
import { ownershipTransferBillingLabel, ownershipTransferStatusCopy, ownershipTransferStatusLabel } from '../lib/ownershipTransfer.js';
import { projectContext } from '../lib/projectContext.js';
import { notify } from '../lib/uiFeedback.js';
import './AdminPanel.css';

const VIEWS = [
  ['overview', '대시보드'],
  ['accounts', '회원'],
  ['pages', '페이지'],
  ['leadSummary', '접수 현황'],
  ['billing', '결제'],
  ['files', '파일'],
  ['risks', '리스크'],
  ['ops', '운영'],
];

const formatNumber = (value) => Number(value || 0).toLocaleString('ko-KR');
const formatWon = (value) => `${formatNumber(value)}원`;
const formatMb = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return '0MB';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024).toLocaleString('ko-KR')}KB`;
  return `${Math.ceil(value / 1024 / 1024).toLocaleString('ko-KR')}MB`;
};
const safeArray = (value) => (Array.isArray(value) ? value : []);
const dateText = (value) => (value ? String(value).slice(0, 10) : '-');
const compactStatus = (value = '') => String(value || 'unknown').replace(/_/g, ' ');
const isPaidProject = (project = {}) => {
  const plan = String(project.plan || project.billingPlan || '').toLowerCase();
  const billing = String(project.billingStatus || project.billing_status || '').toLowerCase();
  return billing === 'active' || (plan && !['free', 'trial'].includes(plan));
};
const projectLeadCount = (project = {}) => Number(project.leadCount || project.totalLeads || project.leads || 0);

function metricFromSnapshot(snapshot = {}, fallback, key) {
  const value = snapshot?.summary?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export default function MasterAdminPanel({ page, leads = [], events = [], updatePage, setStartMode, authUser = null, onExit }) {
  const context = useMemo(() => projectContext(page, authUser), [authUser, page]);
  const [activeView, setActiveView] = useState('overview');
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');
  const [transferQueue, setTransferQueue] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferBusyId, setTransferBusyId] = useState('');

  const currentProject = useMemo(() => {
    const title = page.title || page.blocks?.find((block) => block.type === 'hero')?.s?.title || '현재 랜딩페이지';
    return {
      id: page.projectId || context.projectId || page.slug || 'local-project',
      slug: page.slug || context.slug || '',
      title,
      ownerEmail: authUser?.email || page.ownership?.ownerEmail || '',
      status: page.status || 'active',
      plan: page.plan || 'free',
      billingStatus: page.billingStatus || 'trial',
      leadCount: leads.length,
      todayLeadCount: leads.filter((lead) => dateText(lead.createdAt || lead.savedAt) === dateText(new Date().toISOString())).length,
      monthLeadCount: leads.filter((lead) => dateText(lead.createdAt || lead.savedAt).slice(0, 7) === dateText(new Date().toISOString()).slice(0, 7)).length,
      eventCount: events.length,
      fileBytes: Number(page.fileBytes || page.storageBytes || 0),
      fileCount: Number(page.fileCount || 0),
      fileDownloadCount: Number(page.fileDownloadCount || 0),
      updatedAt: page.updatedAt || page.lastSavedAt || '',
      createdAt: page.createdAt || '',
      usesFileWidget: safeArray(page.blocks).some((block) => block.type === 'download' || block.type === 'file'),
    };
  }, [authUser?.email, context.projectId, context.slug, events.length, leads, page]);

  const accounts = useMemo(() => {
    const rows = safeArray(snapshot?.accounts);
    if (rows.length) return rows;
    return [{
      id: authUser?.ownerId || authUser?.id || 'current-master',
      email: authUser?.email || '',
      name: authUser?.name || '마스터 운영자',
      status: authUser?.status || 'active',
      plan: authUser?.plan || 'free',
      billingStatus: authUser?.billingStatus || 'trial',
      projectCount: 1,
      paidProjectCount: isPaidProject(currentProject) ? 1 : 0,
      fileBytes: currentProject.fileBytes,
      createdAt: authUser?.createdAt || '',
      lastActiveAt: authUser?.lastActiveAt || currentProject.updatedAt,
    }];
  }, [authUser, currentProject, snapshot]);

  const projects = useMemo(() => {
    const rows = safeArray(snapshot?.projects);
    return rows.length ? rows : [currentProject];
  }, [currentProject, snapshot]);

  const leadSummaryRows = useMemo(() => {
    const rows = safeArray(snapshot?.leadSummary);
    if (rows.length) return rows;
    return projects.map((project) => ({
      ...project,
      totalLeads: projectLeadCount(project),
      todayLeads: Number(project.todayLeadCount || project.todayLeads || 0),
      monthLeads: Number(project.monthLeadCount || project.monthLeads || 0),
      blockedLeads: Number(project.blockedLeadCount || project.blockedLeads || 0),
      lastLeadAt: project.lastLeadAt || leads[0]?.createdAt || leads[0]?.savedAt || '',
    }));
  }, [leads, projects, snapshot]);

  const fileRows = useMemo(() => {
    const rows = safeArray(snapshot?.files);
    if (rows.length) return rows;
    return projects.map((project) => ({
      ...project,
      fileBytes: Number(project.fileBytes || project.storageBytes || 0),
      fileCount: Number(project.fileCount || 0),
      downloadCount: Number(project.fileDownloadCount || project.downloadCount || 0),
      uploadAllowed: isPaidProject(project),
      usesFileWidget: !!project.usesFileWidget,
    }));
  }, [projects, snapshot]);

  const summary = useMemo(() => {
    const pageViews = events.filter((event) => event.type === 'page_view').length;
    const ctaClicks = events.filter((event) => event.type === 'cta_click').length;
    const activeProjects = projects.filter((project) => compactStatus(project.status) !== 'archived').length;
    const paidProjects = projects.filter(isPaidProject).length;
    const paidAccounts = accounts.filter((account) => {
      const plan = String(account.plan || account.billingPlan || '').toLowerCase();
      const billing = String(account.billingStatus || account.billing_status || '').toLowerCase();
      return billing === 'active' || Number(account.paidProjectCount || 0) > 0 || (plan && !['free', 'trial'].includes(plan));
    }).length;
    const fileBytes = fileRows.reduce((sum, row) => sum + Number(row.fileBytes || 0), 0);
    const downloads = fileRows.reduce((sum, row) => sum + Number(row.downloadCount || 0), 0);
    return {
      accounts: metricFromSnapshot(snapshot, accounts.length, 'accounts'),
      paidAccounts: metricFromSnapshot(snapshot, paidAccounts, 'paidAccounts'),
      freeAccounts: metricFromSnapshot(snapshot, Math.max(0, accounts.length - paidAccounts), 'freeAccounts'),
      projects: metricFromSnapshot(snapshot, projects.length, 'projects'),
      paidProjects: metricFromSnapshot(snapshot, paidProjects, 'paidProjects'),
      freeProjects: metricFromSnapshot(snapshot, Math.max(0, projects.length - paidProjects), 'freeProjects'),
      activeProjects: metricFromSnapshot(snapshot, activeProjects, 'activeProjects'),
      leads: metricFromSnapshot(snapshot, leads.length, 'leads'),
      todayLeads: metricFromSnapshot(snapshot, leadSummaryRows.reduce((sum, row) => sum + Number(row.todayLeads || 0), 0), 'todayLeads'),
      monthLeads: metricFromSnapshot(snapshot, leadSummaryRows.reduce((sum, row) => sum + Number(row.monthLeads || 0), 0), 'monthLeads'),
      blockedLeads: metricFromSnapshot(snapshot, leadSummaryRows.reduce((sum, row) => sum + Number(row.blockedLeads || 0), 0), 'blockedLeads'),
      pageViews: metricFromSnapshot(snapshot, pageViews, 'pageViews'),
      ctaClicks: metricFromSnapshot(snapshot, ctaClicks, 'ctaClicks'),
      filePages: metricFromSnapshot(snapshot, fileRows.filter((row) => row.usesFileWidget || Number(row.fileCount || 0) > 0).length, 'filePages'),
      fileBytes: metricFromSnapshot(snapshot, fileBytes, 'fileBytes'),
      fileDownloads: metricFromSnapshot(snapshot, downloads, 'fileDownloads'),
      managerMembers: metricFromSnapshot(snapshot, 0, 'managerMembers'),
      pendingInvites: metricFromSnapshot(snapshot, 0, 'pendingInvites'),
      failedDeliveries: metricFromSnapshot(snapshot, 0, 'failedDeliveries'),
      retryableDeliveries: metricFromSnapshot(snapshot, 0, 'retryableDeliveries'),
      activeAiKeys: metricFromSnapshot(snapshot, 0, 'activeAiKeys'),
      aiDrafts: metricFromSnapshot(snapshot, 0, 'aiDrafts'),
      pendingOwnershipTransfers: metricFromSnapshot(snapshot, 0, 'pendingOwnershipTransfers'),
      auditLogs: metricFromSnapshot(snapshot, 0, 'auditLogs'),
    };
  }, [accounts, events, fileRows, leadSummaryRows, leads.length, projects, snapshot]);

  const risks = useMemo(() => buildRisks({ projects, leadSummaryRows, fileRows, summary }), [fileRows, leadSummaryRows, projects, summary]);
  const limitedMode = !snapshot;

  const loadMasterSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotError('');
    try {
      const res = await apiFetch('/api/admin/summary', { headers: projectAuthHeaders(context) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      setSnapshot(data);
    } catch (error) {
      setSnapshot(null);
      setSnapshotError(`전체 관리자 데이터 연결 실패: ${String(error?.message || error)}`);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const loadTransferQueue = async () => {
    if (!context.projectId) return;
    setTransferLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: context.projectId,
        ownerId: context.ownerId,
        slug: context.slug,
        limit: '20',
      });
      const res = await apiFetch(`/api/projects/ownership-transfer?${params.toString()}`, {
        headers: projectAuthHeaders(context),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTransferQueue(safeArray(data.requests));
    } catch (error) {
      notify(`소유권 이전 요청을 불러오지 못했습니다. ${String(error?.message || error)}`, 'error');
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    loadMasterSnapshot();
    loadTransferQueue();
  }, [context.projectId, context.ownerId, context.slug, context.session]);

  const updateTransferStatus = async (request, status, billingClearanceStatus = '') => {
    if (!request?.id) return;
    setTransferBusyId(request.id);
    try {
      const data = await postJson(`/api/admin/ownership-transfer/${encodeURIComponent(request.id)}`, {
        project: context,
        status,
        billingClearanceStatus,
      }, {
        method: 'POST',
        headers: projectAuthHeaders(context),
      });
      const nextRequest = data.request || { ...request, status, billingClearanceStatus };
      setTransferQueue((queue) => queue.map((item) => (item.id === request.id ? nextRequest : item)));
      notify('소유권 이전 상태를 저장했습니다.', 'success');
    } catch (error) {
      notify(`소유권 이전 상태 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
    } finally {
      setTransferBusyId('');
    }
  };

  return (
    <div className="admin-master-shell">
      <header className="admin-master-hero">
        <div>
          <span className="admin-eyebrow">MASTER CONSOLE</span>
          <h1>전체 서비스 관리자</h1>
          <p>회원, 페이지, 결제, 파일 사용량, 접수 추이와 운영 리스크를 개인정보 노출 없이 확인합니다.</p>
        </div>
        <div className="admin-hero-actions">
          <button type="button" onClick={loadMasterSnapshot} disabled={snapshotLoading}>
            {snapshotLoading ? '새로고침 중' : '전체 데이터 새로고침'}
          </button>
          {onExit && <button type="button" className="secondary" onClick={onExit}>작업 화면으로</button>}
        </div>
      </header>

      <div className={`admin-mode-strip ${limitedMode ? 'is-limited' : 'is-live'}`}>
        <strong>{limitedMode ? '제한 모드' : '전체 운영 모드'}</strong>
        <span>{snapshotError || (limitedMode ? '전체 관리자 API가 연결되지 않아 현재 로그인 프로젝트 기준으로 표시합니다.' : '전체 DB 기준 운영 데이터가 연결되어 있습니다.')}</span>
      </div>

      <nav className="admin-master-tabs" aria-label="관리자 메뉴">
        {VIEWS.map(([id, label]) => (
          <button key={id} type="button" className={activeView === id ? 'active' : ''} onClick={() => setActiveView(id)}>
            {label}
          </button>
        ))}
      </nav>

      {activeView === 'overview' && <Overview summary={summary} leadSummaryRows={leadSummaryRows} risks={risks} />}
      {activeView === 'accounts' && <AccountsView accounts={accounts} />}
      {activeView === 'pages' && <ProjectsView projects={projects} updatePage={updatePage} currentProjectId={currentProject.id} />}
      {activeView === 'leadSummary' && <LeadSummaryView rows={leadSummaryRows} />}
      {activeView === 'billing' && <BillingView projects={projects} accounts={accounts} summary={summary} />}
      {activeView === 'files' && <FilesView rows={fileRows} summary={summary} />}
      {activeView === 'risks' && <RisksView risks={risks} />}
      {activeView === 'ops' && (
        <OpsView
          transferQueue={transferQueue}
          transferLoading={transferLoading}
          transferBusyId={transferBusyId}
          loadTransferQueue={loadTransferQueue}
          updateTransferStatus={updateTransferStatus}
          summary={summary}
          resetStartMode={() => {
            localStorage.removeItem(START_MODE_KEY);
            setStartMode('');
            notify('시작 선택 화면을 다시 띄우도록 설정했습니다.', 'success');
          }}
        />
      )}
    </div>
  );
}

function Overview({ summary, leadSummaryRows, risks }) {
  const topPages = [...leadSummaryRows].sort((a, b) => Number(b.totalLeads || 0) - Number(a.totalLeads || 0)).slice(0, 6);
  return (
    <div className="admin-master-grid">
      <Metric label="전체 회원" value={summary.accounts} />
      <Metric label="유료 회원" value={summary.paidAccounts} tone="good" />
      <Metric label="무료 회원" value={summary.freeAccounts} />
      <Metric label="전체 페이지" value={summary.projects} />
      <Metric label="유료 페이지" value={summary.paidProjects} tone="good" />
      <Metric label="무료 페이지" value={summary.freeProjects} />
      <Metric label="이번 달 접수" value={summary.monthLeads} />
      <Metric label="파일 사용 페이지" value={summary.filePages} />
      <section className="admin-master-card span-2">
        <CardTitle title="페이지별 접수 상위" desc="개별 고객 정보 없이 페이지 단위 접수량만 봅니다." />
        <SimpleTable columns={['페이지', '소유 회원', '전체', '오늘', '이번 달']} rows={topPages.map((row) => [
          row.title || row.slug || row.id,
          row.ownerEmail || row.owner_email || row.owner_account_email || '-',
          formatNumber(row.totalLeads || 0),
          formatNumber(row.todayLeads || 0),
          formatNumber(row.monthLeads || 0),
        ])} />
      </section>
      <section className="admin-master-card span-2">
        <CardTitle title="운영 리스크" desc="비용, 결제, 과사용, 스팸 의심 항목을 먼저 확인합니다." />
        <RiskList risks={risks.slice(0, 5)} />
      </section>
      <section className="admin-master-card span-4">
        <CardTitle title="서비스 구성 요약" desc="전체 서비스 운영에 필요한 핵심 수치만 모았습니다." />
        <div className="admin-summary-strip">
          <Badge label="활성 페이지" value={summary.activeProjects} />
          <Badge label="오늘 접수" value={summary.todayLeads} />
          <Badge label="중복/스팸 차단" value={summary.blockedLeads} />
          <Badge label="파일 저장량" value={formatMb(summary.fileBytes)} raw />
          <Badge label="다운로드" value={summary.fileDownloads} />
          <Badge label="조회" value={summary.pageViews} />
        </div>
      </section>
    </div>
  );
}

function AccountsView({ accounts }) {
  return (
    <section className="admin-master-card">
      <CardTitle title="회원 관리" desc="회원별 보유 페이지, 유료 페이지, 플랜과 최근 활동만 확인합니다." />
      <SimpleTable columns={['회원', '이메일', '플랜', '보유 페이지', '유료 페이지', '파일 사용량', '최근 활동']} rows={accounts.map((account) => [
        account.name || '-',
        account.email || '-',
        account.plan || account.billingPlan || 'free',
        formatNumber(account.projectCount || account.projects || 0),
        formatNumber(account.paidProjectCount || account.paidProjects || 0),
        formatMb(account.fileBytes || account.storageBytes || 0),
        dateText(account.lastActiveAt || account.updatedAt || account.createdAt),
      ])} />
    </section>
  );
}

function ProjectsView({ projects, updatePage, currentProjectId }) {
  return (
    <section className="admin-master-card">
      <CardTitle title="페이지 관리" desc="페이지별 소유자, 플랜, 접수량, 파일 사용 여부와 최근 수정일을 봅니다." />
      <SimpleTable columns={['페이지', 'URL', '도메인', '소유 회원', '플랜', '상태', '접수', '파일', '최근 수정']} rows={projects.map((project) => [
        project.title || project.slug || project.id,
        `/${project.slug || '-'}`,
        project.customDomain || (project.domainType === 'custom' ? 'DNS 대기' : 'pagero.kr'),
        project.ownerEmail || project.owner_email || project.owner_account_email || '-',
        isPaidProject(project) ? '유료' : '무료',
        compactStatus(project.status),
        formatNumber(projectLeadCount(project)),
        project.usesFileWidget || Number(project.fileCount || 0) > 0 ? '사용' : '-',
        project.id === currentProjectId ? <button type="button" className="mini-action" onClick={() => updatePage({ status: project.status || 'active' })}>현재 페이지</button> : dateText(project.updatedAt || project.updated_at),
      ])} />
    </section>
  );
}

function LeadSummaryView({ rows }) {
  return (
    <section className="admin-master-card">
      <CardTitle title="접수 현황" desc="마스터 화면에서는 고객명, 연락처, 문의 내용은 표시하지 않습니다." />
      <SimpleTable columns={['페이지', 'URL', '소유 회원', '전체 접수', '오늘', '이번 달', '중복/스팸', '최근 접수']} rows={rows.map((row) => [
        row.title || row.slug || row.id,
        `/${row.slug || '-'}`,
        row.ownerEmail || row.owner_email || row.owner_account_email || '-',
        formatNumber(row.totalLeads || 0),
        formatNumber(row.todayLeads || 0),
        formatNumber(row.monthLeads || 0),
        formatNumber(row.blockedLeads || 0),
        dateText(row.lastLeadAt),
      ])} />
    </section>
  );
}

function BillingView({ projects, accounts, summary }) {
  return (
    <div className="admin-master-grid">
      <Metric label="유료 회원" value={summary.paidAccounts} tone="good" />
      <Metric label="무료 회원" value={summary.freeAccounts} />
      <Metric label="유료 페이지" value={summary.paidProjects} tone="good" />
      <Metric label="무료 페이지" value={summary.freeProjects} />
      <Metric label="결제 완료" value={summary.paidPayments || 0} />
      <Metric label="결제 금액" value={formatWon(summary.paidAmount || 0)} raw tone="good" />
      <Metric label="활성 구독" value={summary.activeSubscriptions || 0} />
      <Metric label="미납 구독" value={summary.pastDueSubscriptions || 0} tone="warn" />
      <section className="admin-master-card span-2">
        <CardTitle title="회원 결제 요약" desc="유료 전환과 미납 리스크를 회원 단위로 확인합니다." />
        <SimpleTable columns={['회원', '이메일', '플랜', '결제 상태', '유료 페이지']} rows={accounts.map((account) => [
          account.name || '-',
          account.email || '-',
          account.plan || account.billingPlan || 'free',
          account.billingStatus || account.billing_status || 'trial',
          formatNumber(account.paidProjectCount || account.paidProjects || 0),
        ])} />
      </section>
      <section className="admin-master-card span-2">
        <CardTitle title="페이지 결제 요약" desc="파일 업로드 같은 유료 기능 권한을 페이지 단위로 봅니다." />
        <SimpleTable columns={['페이지', '플랜', '결제 상태', '결제액', '최근 결제', '파일 권한']} rows={projects.map((project) => [
          project.title || project.slug || project.id,
          project.plan || 'free',
          project.billingStatus || project.billing_status || 'trial',
          formatWon(project.paidAmount || 0),
          dateText(project.lastPaymentAt),
          isPaidProject(project) ? '허용' : '차단',
        ])} />
      </section>
    </div>
  );
}

function FilesView({ rows, summary }) {
  return (
    <div className="admin-master-grid">
      <Metric label="파일 사용 페이지" value={summary.filePages} />
      <Metric label="총 저장 용량" value={formatMb(summary.fileBytes)} raw />
      <Metric label="다운로드 추정" value={summary.fileDownloads} />
      <Metric label="무료 파일 사용" value={rows.filter((row) => !isPaidProject(row) && (row.usesFileWidget || Number(row.fileCount || 0) > 0)).length} tone="warn" />
      <section className="admin-master-card span-4">
        <CardTitle title="파일/스토리지" desc="R2 비용 관리를 위해 파일은 페이지 단위로만 집계합니다." />
        <SimpleTable columns={['페이지', '소유 회원', '플랜', '파일 수', '저장 용량', '다운로드', '업로드 권한']} rows={rows.map((row) => [
          row.title || row.slug || row.id,
          row.ownerEmail || row.owner_email || row.owner_account_email || '-',
          isPaidProject(row) ? '유료' : '무료',
          formatNumber(row.fileCount || 0),
          formatMb(row.fileBytes || 0),
          formatNumber(row.downloadCount || 0),
          row.uploadAllowed ? '허용' : '차단',
        ])} />
      </section>
    </div>
  );
}

function RisksView({ risks }) {
  return (
    <section className="admin-master-card">
      <CardTitle title="운영 리스크" desc="조치가 필요한 페이지와 비용 리스크를 먼저 정리합니다." />
      <RiskList risks={risks} />
    </section>
  );
}

function OpsView({ transferQueue, transferLoading, transferBusyId, loadTransferQueue, updateTransferStatus, summary, resetStartMode }) {
  return (
    <div className="admin-master-grid">
      <Metric label="매니저" value={summary.managerMembers || 0} />
      <Metric label="대기 초대" value={summary.pendingInvites || 0} tone={summary.pendingInvites ? 'warn' : ''} />
      <Metric label="전송 실패" value={summary.failedDeliveries || 0} tone={summary.failedDeliveries ? 'warn' : ''} />
      <Metric label="AI 키" value={summary.activeAiKeys || 0} />
      <Metric label="AI 초안" value={summary.aiDrafts || 0} />
      <Metric label="소유권 이전" value={summary.pendingOwnershipTransfers || 0} tone={summary.pendingOwnershipTransfers ? 'warn' : ''} />
      <Metric label="재시도 큐" value={summary.retryableDeliveries || 0} tone={summary.retryableDeliveries ? 'warn' : ''} />
      <Metric label="감사 로그" value={summary.auditLogs || 0} />
      <section className="admin-master-card span-2">
        <CardTitle title="운영 도구" desc="전체 운영자가 직접 실행하는 최소 조치만 둡니다." />
        <div className="admin-tool-list">
          <button type="button" onClick={resetStartMode}>시작 화면 다시 선택</button>
          <button type="button" onClick={loadTransferQueue} disabled={transferLoading}>{transferLoading ? '확인 중' : '소유권 이전 새로고침'}</button>
        </div>
      </section>
      <section className="admin-master-card span-2">
        <CardTitle title="소유권 이전 승인" desc="결제 상태 확인 후 승인, 완료, 거절합니다." />
        <div className="admin-transfer-list">
          {!transferLoading && transferQueue.length === 0 && <div className="admin-empty">대기 중인 소유권 이전 요청이 없습니다.</div>}
          {transferQueue.map((request) => {
            const busy = transferBusyId === request.id;
            return (
              <div className="admin-transfer-row" key={request.id}>
                <div>
                  <strong>{request.managerName || request.managerEmail || request.toAccountId || '대상 미확인'}</strong>
                  <span>{request.managerEmail || request.toAccountId} · {ownershipTransferStatusLabel(request.status)}</span>
                  <small>{dateText(request.requestedAt)} · {ownershipTransferBillingLabel(request.billingClearanceStatus)}</small>
                  <small>{ownershipTransferStatusCopy(request.status)}</small>
                </div>
                <div className="admin-transfer-actions">
                  <button type="button" disabled={busy} onClick={() => updateTransferStatus(request, 'waiting_billing_clearance', 'active_subscription')}>결제대기</button>
                  <button type="button" disabled={busy} onClick={() => updateTransferStatus(request, 'approved', 'clear')}>승인</button>
                  <button type="button" disabled={busy || request.billingClearanceStatus !== 'clear'} onClick={() => updateTransferStatus(request, 'completed', 'clear')}>완료</button>
                  <button type="button" disabled={busy} onClick={() => updateTransferStatus(request, 'rejected', request.billingClearanceStatus || 'not_checked')}>거절</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function buildRisks({ projects, leadSummaryRows, fileRows, summary }) {
  const risks = [];
  const freeFileRows = fileRows.filter((row) => !isPaidProject(row) && (row.usesFileWidget || Number(row.fileCount || 0) > 0));
  if (freeFileRows.length) {
    risks.push({ level: 'high', title: '무료 페이지 파일 사용', count: freeFileRows.length, detail: '유료 플랜 조건과 파일 권한을 확인해야 합니다.' });
  }
  const heavyLeads = leadSummaryRows.filter((row) => Number(row.todayLeads || 0) >= 50 || Number(row.monthLeads || 0) >= 500);
  if (heavyLeads.length) {
    risks.push({ level: 'warn', title: '접수 과다 페이지', count: heavyLeads.length, detail: '광고 성과인지 스팸 유입인지 확인이 필요합니다.' });
  }
  const pastDue = projects.filter((project) => ['past_due', 'expired'].includes(String(project.billingStatus || project.billing_status || '').toLowerCase()));
  if (pastDue.length) {
    risks.push({ level: 'high', title: '결제 이상 페이지', count: pastDue.length, detail: '미납 또는 만료 상태의 유료 기능 사용 여부를 확인합니다.' });
  }
  const heavyFiles = fileRows.filter((row) => Number(row.fileBytes || 0) >= 1024 * 1024 * 1024 || Number(row.downloadCount || 0) >= 10000);
  if (heavyFiles.length) {
    risks.push({ level: 'warn', title: '파일 비용 증가', count: heavyFiles.length, detail: 'R2 저장량과 다운로드 추이를 확인합니다.' });
  }
  if (Number(summary.blockedLeads || 0) > 0) {
    risks.push({ level: 'info', title: '중복/스팸 차단', count: summary.blockedLeads, detail: '차단 정책이 정상 작동 중인지 월별로 확인합니다.' });
  }
  if (!risks.length) {
    risks.push({ level: 'good', title: '즉시 조치 리스크 없음', count: 0, detail: '현재 집계 기준으로 심각한 운영 리스크가 없습니다.' });
  }
  return risks;
}

function Metric({ label, value, raw = false, tone = '' }) {
  return (
    <section className={`admin-metric-card ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{raw ? value : formatNumber(value)}</strong>
    </section>
  );
}

function Badge({ label, value, raw = false }) {
  return (
    <span className="admin-summary-badge">
      <b>{label}</b>
      <strong>{raw ? value : formatNumber(value)}</strong>
    </span>
  );
}

function CardTitle({ title, desc }) {
  return (
    <div className="admin-card-title">
      <h2>{title}</h2>
      {desc && <p>{desc}</p>}
    </div>
  );
}

function RiskList({ risks }) {
  return (
    <div className="admin-risk-list">
      {risks.map((risk, index) => (
        <div className={`admin-risk-row level-${risk.level || 'info'}`} key={`${risk.title}-${index}`}>
          <span>{risk.title}</span>
          <strong>{formatNumber(risk.count || 0)}</strong>
          <small>{risk.detail}</small>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="admin-table">
      <div className="admin-table-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => <span key={column}>{column}</span>)}
      </div>
      {rows.length === 0 ? (
        <div className="admin-empty">표시할 데이터가 없습니다.</div>
      ) : rows.map((row, index) => (
        <div className="admin-table-row" key={index} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}
        </div>
      ))}
    </div>
  );
}
