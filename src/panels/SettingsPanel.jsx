import { useEffect, useMemo, useState } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { Field, ImageInput, Toggle } from '../editor/controls.jsx';
import {
  authAccountErrorMessage,
  changeAuthPassword,
  confirmEmailVerification,
  isValidAccountPassword,
  normalizeAccountPhone,
  requestEmailVerification,
} from '../lib/authAccounts.js';
import {
  DEFAULT_MANAGER_ACCESS,
  MANAGER_PERMISSION_TABS,
  isClientAdminMode,
  isManagerMode,
  normalizeManagerAccount,
  normalizeOwnershipSettings,
} from '../lib/authContext.js';
import { fetchServerBlockedLeadHistory } from '../lib/leadRepository.js';
import { createLocalManagerInvite, createServerManagerInvite, createServerOwnershipTransfer, managerInviteUrl } from '../lib/managerInvites.js';
import { ownershipTransferBillingLabel, ownershipTransferStatusCopy, ownershipTransferStatusLabel } from '../lib/ownershipTransfer.js';
import { normalizePageDuplicateUrl, pageDuplicateUrlIssues, sanitizeDuplicateSlug } from '../lib/pageDuplication.js';
import { normalizeIntegrations } from '../lib/pageModel.js';
import { confirmAction, notify } from '../lib/uiFeedback.js';
import './SettingsPanel.css';

const MANAGER_TAB_LABELS = {
  edit: '편집',
  style: '스타일',
  inbox: '접수함',
  stats: '통계',
  settings: '설정',
};

const MANAGER_ACCESS_PRESETS = [
  {
    id: 'editor',
    label: '편집 담당',
    access: {
      edit: { read: true, write: true },
      style: { read: true, write: true },
      inbox: { read: false, write: false },
      stats: { read: false, write: false },
      settings: { read: false, write: false },
    },
  },
  {
    id: 'operator',
    label: '운영 담당',
    access: {
      edit: { read: false, write: false },
      style: { read: false, write: false },
      inbox: { read: true, write: true },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  },
  {
    id: 'viewer',
    label: '조회 전용',
    access: {
      edit: { read: false, write: false },
      style: { read: false, write: false },
      inbox: { read: true, write: false },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  },
];

const DEFAULT_DUPLICATE_COLLECTION_SETTINGS = {
  rejectIpDuplicate: false,
  rejectCookieDuplicate: true,
  formDuplicateLimitCount: '3',
  formDuplicateLimitWindow: '1d',
  phoneEmailMode: 'mark',
};

const DUPLICATE_LIMIT_COUNTS = [
  ['1', '?? ???? 1? ???? ??'],
  ['2', '?? ???? 2? ???? ??'],
  ['3', '?? ???? 3? ???? ??'],
  ['5', '?? ???? 5? ???? ??'],
];

const DUPLICATE_LIMIT_WINDOWS = [
  ['1d', '1?'],
  ['3d', '3?'],
  ['7d', '7?'],
  ['30d', '1??'],
];

function normalizeDuplicateCollectionSettings(settings = {}) {
  return {
    ...DEFAULT_DUPLICATE_COLLECTION_SETTINGS,
    ...(settings || {}),
    rejectIpDuplicate: !!settings.rejectIpDuplicate,
    rejectCookieDuplicate: settings.rejectCookieDuplicate !== false,
    formDuplicateLimitCount: ['1', '2', '3', '5'].includes(String(settings.formDuplicateLimitCount || ''))
      ? String(settings.formDuplicateLimitCount)
      : DEFAULT_DUPLICATE_COLLECTION_SETTINGS.formDuplicateLimitCount,
    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(String(settings.formDuplicateLimitWindow || ''))
      ? String(settings.formDuplicateLimitWindow)
      : DEFAULT_DUPLICATE_COLLECTION_SETTINGS.formDuplicateLimitWindow,
    phoneEmailMode: ['mark', 'warn', 'block'].includes(String(settings.phoneEmailMode || ''))
      ? String(settings.phoneEmailMode)
      : DEFAULT_DUPLICATE_COLLECTION_SETTINGS.phoneEmailMode,
  };
}

const BLOCK_REASON_LABELS = {
  phone_duplicate: '??? ??',
  email_duplicate: '??? ??',
  client_duplicate_limit: '?? ??',
  ip_duplicate_limit: 'IP ??',
  ip_rate_limit_1m: 'IP ?? ??',
  rate_limited: '?? ??',
};

function currentHistoryMonth() {
  return new Date().toISOString().slice(0, 7);
}

function blockedHistoryLabel(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function blockedHistoryReason(reason) {
  const key = String(reason || '').trim();
  return BLOCK_REASON_LABELS[key] || key || '??';
}

function blockedHistoryIdentity(item = {}) {
  return blockedHistoryLabel(
    item.contactSummary || item.maskedContact || item.clientId || item.userAgentHash,
    '?? ?? ??',
  );
}

function DuplicateSelect({ label, value, options, disabled = false, onChange }) {
  return (
    <label className="duplicate-policy-select">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function newManager() {
  return normalizeManagerAccount({
    id: `manager-${Date.now()}`,
    name: '',
    email: '',
    status: 'active',
    invitedAt: new Date().toISOString(),
    access: DEFAULT_MANAGER_ACCESS,
  });
}

function normalizeInvitePatch(invite = {}) {
  return {
    inviteToken: invite.token || '',
    inviteUrl: managerInviteUrl(invite.token),
    inviteStatus: invite.status || 'pending',
    invitedAt: invite.invitedAt || new Date().toISOString(),
    acceptedAt: invite.acceptedAt || '',
    expiresAt: invite.expiresAt || '',
  };
}

function managerLabel(manager) {
  return manager.name || manager.email || '새 매니저';
}

function managerAccessSummary(manager) {
  const access = manager.access || {};
  const editable = MANAGER_PERMISSION_TABS.filter((tab) => access[tab]?.write).map((tab) => MANAGER_TAB_LABELS[tab]);
  const viewOnly = MANAGER_PERMISSION_TABS.filter((tab) => access[tab]?.read && !access[tab]?.write).map((tab) => MANAGER_TAB_LABELS[tab]);
  if (manager.status !== 'active') return '비활성';
  if (editable.length) return `편집 ${editable.join(', ')}`;
  if (viewOnly.length) return `보기 ${viewOnly.join(', ')}`;
  return '권한 없음';
}

function managerInviteState(manager, inviteUrl = '') {
  if (manager.acceptedAt) return '가입 완료';
  if (inviteUrl) return '초대 링크 있음';
  return '초대 전';
}

function SettingsSection({ id, title, openSection, setOpenSection, locked = false, onSave, onEdit, children, className = '' }) {
  const open = openSection === id;
  return (
    <section className={`card settings-section ${open ? 'open' : ''} ${className}`}>
      <button type="button" className="settings-section-head" onClick={() => setOpenSection(open ? '' : id)}>
        <h2>{title}</h2>
        <span>{open ? '접기' : '열기'}</span>
      </button>
      {open && (
        <div className="settings-section-body">
          {children}
          {(onSave || onEdit) && (
            <div className="settings-section-actions">
              {locked ? (
                <button type="button" onClick={onEdit}>수정</button>
              ) : (
                <button type="button" onClick={onSave}>저장</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AccountSettingsSection({ authUser, onAccountUpdate, onLogout }) {
  const [profileDraft, setProfileDraft] = useState({ name: authUser?.name || '', phone: authUser?.phone || '' });
  const [passwordDraft, setPasswordDraft] = useState({ code: '', password: '', password2: '' });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const email = String(authUser?.email || '').trim().toLowerCase();

  useEffect(() => {
    setProfileDraft({ name: authUser?.name || '', phone: authUser?.phone || '' });
  }, [authUser?.name, authUser?.phone]);

  if (!authUser) {
    return <p className="account-settings-empty">로그인된 계정이 없습니다.</p>;
  }

  const setProfileField = (key, value) => {
    setError('');
    setNotice('');
    setProfileDraft((draft) => ({ ...draft, [key]: value }));
  };

  const setPasswordField = (key, value) => {
    setError('');
    setNotice('');
    setPasswordDraft((draft) => ({ ...draft, [key]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!onAccountUpdate) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await onAccountUpdate({
        name: profileDraft.name,
        phone: normalizeAccountPhone(profileDraft.phone),
      });
      setNotice('계정 정보가 저장되었습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordCode = async () => {
    if (!email) {
      setError('계정 이메일을 확인할 수 없습니다.');
      return;
    }
    setVerifying(true);
    setError('');
    setNotice('');
    try {
      const verification = await requestEmailVerification(email, 'password-reset');
      setNotice(verification?.token ? `개발 확인용 인증값: ${verification.token}` : '인증 메일을 보냈습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!email) {
      setError('계정 이메일을 확인할 수 없습니다.');
      return;
    }
    if (!passwordDraft.code.trim()) {
      setError('인증 코드를 입력해주세요.');
      return;
    }
    if (!isValidAccountPassword(passwordDraft.password)) {
      setError('비밀번호는 영문과 숫자를 포함해 6자리 이상이어야 합니다.');
      return;
    }
    if (passwordDraft.password !== passwordDraft.password2) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }
    setChanging(true);
    setError('');
    setNotice('');
    try {
      await confirmEmailVerification({ email, token: passwordDraft.code.trim() });
      await changeAuthPassword({ email, password: passwordDraft.password, token: passwordDraft.code.trim() });
      setPasswordDraft({ code: '', password: '', password2: '' });
      setNotice('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="account-settings-card">
      <form className="account-settings-form" onSubmit={saveProfile}>
        <div className="account-settings-grid">
          <label>
            <span>이름</span>
            <input value={profileDraft.name} onChange={(event) => setProfileField('name', event.target.value)} placeholder="이름" />
          </label>
          <label>
            <span>이메일</span>
            <input value={email} disabled placeholder="email@example.com" />
          </label>
          <label>
            <span>휴대폰</span>
            <input type="tel" inputMode="tel" value={profileDraft.phone} onChange={(event) => setProfileField('phone', event.target.value)} placeholder="01012345678" />
          </label>
          <div className="account-settings-actions">
            <button type="submit" disabled={saving}>{saving ? '저장 중' : '계정 저장'}</button>
            <button type="button" onClick={onLogout}>로그아웃</button>
          </div>
        </div>
      </form>

      <form className="account-password-form" onSubmit={changePassword}>
        <div className="account-password-head">
          <strong>비밀번호 변경</strong>
          <button type="button" disabled={verifying} onClick={sendPasswordCode}>{verifying ? '발송 중' : '인증 메일 보내기'}</button>
        </div>
        <div className="account-settings-grid">
          <label>
            <span>인증 코드</span>
            <input value={passwordDraft.code} onChange={(event) => setPasswordField('code', event.target.value)} placeholder="이메일 인증 코드" />
          </label>
          <label>
            <span>새 비밀번호</span>
            <input type="password" value={passwordDraft.password} onChange={(event) => setPasswordField('password', event.target.value)} placeholder="영문+숫자 6자리 이상" />
          </label>
          <label>
            <span>새 비밀번호 확인</span>
            <input type="password" value={passwordDraft.password2} onChange={(event) => setPasswordField('password2', event.target.value)} placeholder="다시 입력" />
          </label>
          <div className="account-settings-actions">
            <button type="submit" disabled={changing}>{changing ? '변경 중' : '비밀번호 변경'}</button>
          </div>
        </div>
      </form>
      {notice && <p className="account-settings-notice">{notice}</p>}
      {error && <p className="account-settings-error">{error}</p>}
    </div>
  );
}

export default function SettingsPanel({
  page,
  updatePage,
  updateMeta,
  updateIntegrations,
  onDuplicatePage,
  canDuplicatePage = false,
  onReset,
  authUser = null,
  accessMode = 'builder',
  onAccountUpdate,
  onLogout,
}) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const duplicateCollectionSettings = normalizeDuplicateCollectionSettings(page.leadDuplicateSettings || page.duplicateCollectionSettings || {});
  const blockedDuplicateHistory = Array.isArray(page.leadDuplicateSettings?.blockedHistory)
    ? page.leadDuplicateSettings.blockedHistory
    : Array.isArray(page.blockedLeadHistory)
      ? page.blockedLeadHistory
      : [];
  const ownership = normalizeOwnershipSettings(page, authUser);
  const managers = ownership.managers || [];
  const transferRequest = page.ownership?.transferRequest || null;
  const serverPage = isServerPageMode();
  const clientAdminMode = isClientAdminMode(accessMode);
  const managerMode = isManagerMode(accessMode);
  const canManageProjectUsers = !managerMode;
  const [managerDraft, setManagerDraft] = useState(() => managers.map(normalizeManagerAccount));
  const eligibleTransferManagers = useMemo(() => managerDraft.filter((manager) => manager.email && manager.status === 'active'), [managerDraft]);
  const [transferManagerId, setTransferManagerId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [expandedManagerId, setExpandedManagerId] = useState('');
  const [expandedManagerMenuId, setExpandedManagerMenuId] = useState('');
  const [inviteLoading, setInviteLoading] = useState('');
  const [conversionLocked, setConversionLocked] = useState(() => !!(page.meta?.ads || page.meta?.pixel || page.meta?.naver || page.meta?.kakao));
  const [openSection, setOpenSection] = useState('duplicatePolicy');
  const [lockedSections, setLockedSections] = useState({ basic: false, duplicatePolicy: false, managers: false, send: false, seo: false, tracking: false });
  const [duplicatePolicyDraft, setDuplicatePolicyDraft] = useState(() => duplicateCollectionSettings);
  const [blockedHistoryMonth, setBlockedHistoryMonth] = useState(currentHistoryMonth);
  const [blockedHistoryState, setBlockedHistoryState] = useState({
    records: [],
    total: 0,
    loading: false,
    error: '',
    loaded: false,
  });
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateDraft, setDuplicateDraft] = useState(() => normalizePageDuplicateUrl({
    domainType: 'default',
    slug: `${sanitizeDuplicateSlug(page.slug || 'my-page') || 'my-page'}-copy`,
  }));
  const [basicDraft, setBasicDraft] = useState(() => ({ title: page.title || '', slug: page.slug || '' }));
  const [sendDraft, setSendDraft] = useState(() => ({
    webhookEnabled: !!integrations.webhook.enabled,
    webhookUrl: integrations.webhook.url || '',
    automationEnabled: !!integrations.automation.enabled,
    automationUrl: integrations.automation.url || '',
  }));
  const [seoDraft, setSeoDraft] = useState(() => ({
    title: page.meta.title || '',
    desc: page.meta.desc || '',
    favicon: page.meta.favicon || '',
    og: page.meta.og || '',
    naverWebmaster: page.meta.naverWebmaster || '',
    console: page.meta.console || '',
  }));
  const [trackingDraft, setTrackingDraft] = useState(() => ({
    gtm: page.meta.gtm || '',
    ga4: page.meta.ga4 || '',
    googleAdsTag: page.meta.googleAdsTag || '',
    pixel: page.meta.pixel || '',
    naver: page.meta.naver || '',
    kakao: page.meta.kakao || '',
  }));
  const conversionReady = {
    ads: !!String(page.meta?.ads || '').trim(),
    pixel: !!String(page.meta?.pixel || '').trim(),
    naver: !!String(page.meta?.naver || '').trim(),
    kakao: !!String(page.meta?.kakao || '').trim(),
  };
  const hasConversionValue = Object.values(conversionReady).some(Boolean);
  const showConversionToggles = conversionLocked && hasConversionValue;
  const lockSection = (id) => setLockedSections((state) => ({ ...state, [id]: true }));
  const editSection = (id) => setLockedSections((state) => ({ ...state, [id]: false }));
  const saveBasic = () => {
    updatePage({ title: basicDraft.title, slug: String(basicDraft.slug || '').replace(/[^a-zA-Z0-9-_]/g, '') });
    lockSection('basic');
    notify('페이지 기본 설정을 저장했습니다.', 'success');
  };
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
  const saveManagers = () => {
    updateOwnership({ managers: managerDraft.map(normalizeManagerAccount) });
    lockSection('managers');
    notify('매니저 권한을 저장했습니다.', 'success');
  };
  const saveDuplicatePolicy = () => {
    updatePage({ leadDuplicateSettings: normalizeDuplicateCollectionSettings(duplicatePolicyDraft) });
    lockSection('duplicatePolicy');
    notify('수집 데이터 중복 설정을 저장했습니다.', 'success');
  };
  const editDuplicatePolicy = () => {
    setDuplicatePolicyDraft(normalizeDuplicateCollectionSettings(page.leadDuplicateSettings || page.duplicateCollectionSettings || duplicatePolicyDraft));
    editSection('duplicatePolicy');
  };
  const updateDuplicatePolicyDraft = (patch) => {
    setDuplicatePolicyDraft((draft) => normalizeDuplicateCollectionSettings({ ...draft, ...patch }));
  };
  const loadBlockedHistory = async () => {
    if (clientAdminMode) return;
    setBlockedHistoryState((state) => ({ ...state, loading: true, error: '' }));
    try {
      const result = await fetchServerBlockedLeadHistory(page, authUser, {
        month: blockedHistoryMonth,
        pageSlug: page.slug || '',
        limit: 50,
      });
      if (!result) {
        setBlockedHistoryState({
          records: blockedDuplicateHistory,
          total: blockedDuplicateHistory.length,
          loading: false,
          error: '',
          loaded: true,
        });
        return;
      }
      setBlockedHistoryState({
        records: result.records,
        total: result.total,
        loading: false,
        error: '',
        loaded: true,
      });
    } catch (error) {
      setBlockedHistoryState({
        records: blockedDuplicateHistory,
        total: blockedDuplicateHistory.length,
        loading: false,
        error: error?.message || '서버 차단 내역을 불러오지 못했습니다.',
        loaded: true,
      });
    }
  };
  useEffect(() => {
    if (openSection !== 'duplicatePolicy' || clientAdminMode) return;
    loadBlockedHistory();
  }, [openSection, clientAdminMode, blockedHistoryMonth, page.slug, page.projectId, authUser?.session]);
  const editManagers = () => {
    setManagerDraft((managers.length ? managers : managerDraft).map(normalizeManagerAccount));
    editSection('managers');
  };
  const saveSend = () => {
    updateIntegrations('webhook', { enabled: !!sendDraft.webhookEnabled, url: sendDraft.webhookUrl });
    updateIntegrations('automation', { enabled: !!sendDraft.automationEnabled, url: sendDraft.automationUrl });
    lockSection('send');
    notify('전송 설정을 저장했습니다.', 'success');
  };
  const saveSeo = () => {
    updateMeta(seoDraft);
    lockSection('seo');
    notify('SEO 설정을 저장했습니다.', 'success');
  };
  const saveTracking = () => {
    updateMeta(trackingDraft);
    lockSection('tracking');
    notify('추적 코드 설정을 저장했습니다.', 'success');
  };

  const updateConversionMeta = (patch) => {
    setConversionLocked(false);
    updateMeta(patch);
  };

  const saveConversionValues = () => {
    if (!hasConversionValue) {
      notify('전환 추적 값을 하나 이상 입력하세요.', 'error');
      return;
    }
    setConversionLocked(true);
    notify('전환 추적 값을 저장했습니다. 수정 전까지 입력을 잠급니다.', 'success');
  };

  const updateOwnership = (patch) => {
    updatePage({
      ownership: {
        ...ownership,
        ...(page.ownership || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const updateManagerDrafts = (nextManagers) => {
    setManagerDraft(nextManagers.map(normalizeManagerAccount));
  };

  const updateManager = (index, patch) => {
    updateManagerDrafts(managerDraft.map((manager, currentIndex) => (
      currentIndex === index ? normalizeManagerAccount({ ...manager, ...patch }) : manager
    )));
  };

  const managerPermissionMode = (manager, tab) => {
    if (manager.access?.[tab]?.write) return 'write';
    if (manager.access?.[tab]?.read) return 'read';
    return 'none';
  };

  const setManagerPermissionMode = (index, tab, mode) => {
    updateManager(index, {
      access: {
        ...managerDraft[index]?.access,
        [tab]: {
          read: mode === 'read' || mode === 'write',
          write: mode === 'write',
        },
      },
    });
  };

  const setManagerPreset = (index, preset) => {
    updateManager(index, { access: preset.access });
    setExpandedManagerMenuId('');
  };

  const addManager = () => {
    const manager = newManager();
    updateManagerDrafts([...managerDraft, manager]);
    editSection('managers');
    setExpandedManagerId(manager.id);
    notify('매니저 입력 칸을 추가했습니다.', 'success');
  };

  const disableManager = (index) => {
    updateManager(index, { status: 'disabled' });
  };

  const removeManager = async (index) => {
    const manager = managerDraft[index];
    const ok = await confirmAction({
      title: '매니저 삭제',
      message: `${managerLabel(manager)}의 페이지 접근 권한을 제거합니다. 저장하면 서버 접근도 차단됩니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    });
    if (!ok) return;
    updateManagerDrafts(managerDraft.filter((_, currentIndex) => currentIndex !== index));
  };

  const createInvite = async (manager, index) => {
    if (!String(manager.name || '').trim()) {
      notify('매니저 이름을 먼저 입력하세요.', 'error');
      return;
    }
    if (!manager.email) {
      notify('매니저 이메일을 먼저 입력하세요.', 'error');
      return;
    }
    if (manager.status !== 'active') {
      notify('비활성 매니저는 초대할 수 없습니다.', 'error');
      return;
    }
    updateOwnership({ managers: managerDraft.map(normalizeManagerAccount) });
    setInviteLoading(manager.id || manager.email || String(index));
    try {
      const invite = serverPage
        ? await createServerManagerInvite(page, authUser, manager)
        : createLocalManagerInvite(page, manager);
      if (!invite?.token) throw new Error('초대 토큰이 없습니다.');
      const invitePatch = normalizeInvitePatch(invite);
      updateManager(index, invitePatch);
      try {
        await navigator.clipboard.writeText(invitePatch.inviteUrl);
        notify('초대 링크를 복사했습니다.', 'success');
      } catch {
        notify('초대 링크를 발급했습니다. 브라우저 권한 때문에 자동 복사는 실패했습니다.', 'warning');
      }
    } catch (error) {
      notify(`초대 링크 발급에 실패했습니다. ${String(error?.message || error)}`, 'error');
    } finally {
      setInviteLoading('');
    }
  };

  const copyInvite = async (manager) => {
    const url = manager.inviteUrl || managerInviteUrl(manager.inviteToken);
    if (!url) {
      notify('복사할 초대 링크가 없습니다.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('초대 링크를 복사했습니다.', 'success');
    } catch {
      notify('초대 링크를 직접 선택해 복사하세요.', 'warning');
    }
  };

  const requestOwnershipTransfer = async () => {
    const selected = eligibleTransferManagers.find((manager) => manager.id === transferManagerId) || eligibleTransferManagers[0];
    if (!selected) {
      notify('소유권을 넘길 매니저를 먼저 추가하고 이메일을 입력하세요.', 'error');
      return;
    }
    const ok = await confirmAction({
      title: `${managerLabel(selected)}에게 소유권이전 요청`,
      message: '내부 관리자 최종 승인 후 처리됩니다. 결제가 있으면 만료 또는 해지 후 이전하고, 이후 새 소유자 카드 결제로 연결할 예정입니다.',
      confirmLabel: '요청',
    });
    if (!ok) return;
    updateOwnership({
      clientEmail: selected.email,
      clientAccess: true,
      transferRequest: {
        status: 'requested',
        managerId: selected.id,
        managerName: selected.name || '',
        managerEmail: selected.email,
        requestedBy: authUser?.email || ownership.ownerEmail || '',
        requestedAt: new Date().toISOString(),
        billingPolicy: '기존 결제가 있으면 만료 또는 해지 후 소유권이전, 이후 새 소유자 카드 결제 가능',
        adminApprovalRequired: true,
      },
    });
    setTransferManagerId(selected.id);
    notify('소유권이전 요청을 만들었습니다.', 'success');
  };

  const requestOwnershipTransferPersisted = async () => {
    const selected = eligibleTransferManagers.find((manager) => manager.id === transferManagerId) || eligibleTransferManagers[0];
    if (!serverPage) {
      await requestOwnershipTransfer();
      return;
    }
    if (!selected) {
      notify('소유권을 넘길 매니저를 먼저 추가하고 이메일을 입력하세요.', 'error');
      return;
    }
    const ok = await confirmAction({
      title: `${managerLabel(selected)}에게 소유권이전 요청`,
      message: '내부 관리자 최종 승인 후 처리됩니다. 결제가 있으면 만료 또는 해지 후 이전하고, 이후 새 소유자 카드 결제로 연결할 예정입니다.',
      confirmLabel: '요청',
    });
    if (!ok) return;
    try {
      updateOwnership({ managers: managerDraft.map(normalizeManagerAccount) });
      const request = await createServerOwnershipTransfer(page, authUser, {
        managerId: selected.id,
        managerEmail: selected.email,
      });
      updateOwnership({
        clientEmail: selected.email,
        clientAccess: true,
        transferRequest: request || {
          status: 'requested',
          managerId: selected.id,
          managerName: selected.name || '',
          managerEmail: selected.email,
          requestedBy: authUser?.email || ownership.ownerEmail || '',
          requestedAt: new Date().toISOString(),
          billingPolicy: '기존 결제가 있으면 만료 또는 해지 후 소유권이전, 이후 새 소유자 카드 결제 가능',
          adminApprovalRequired: true,
        },
      });
      setTransferManagerId(selected.id);
      notify('소유권이전 요청을 저장했습니다.', 'success');
    } catch (error) {
      notify(`소유권이전 요청에 실패했습니다. ${String(error?.message || error)}`, 'error');
    }
  };

  const cancelOwnershipTransfer = async () => {
    const ok = await confirmAction({
      title: '소유권이전 요청 취소',
      message: '대기 중인 승인 요청만 취소되고 기존 소유권은 유지됩니다.',
      confirmLabel: '취소',
    });
    if (!ok) return;
    updateOwnership({ transferRequest: null });
    notify('소유권이전 요청을 취소했습니다.', 'success');
  };

  const displayedBlockedHistory = blockedHistoryState.loaded
    ? blockedHistoryState.records
    : blockedDuplicateHistory;

  return (
    <div className="simple-panel settings-panel">
      <SettingsSection id="account" title="내 계정" openSection={openSection} setOpenSection={setOpenSection} className="account-settings-section">
        <AccountSettingsSection authUser={authUser} onAccountUpdate={onAccountUpdate} onLogout={onLogout} />
      </SettingsSection>

      <SettingsSection id="basic" title="페이지 기본" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.basic} onSave={saveBasic} onEdit={() => editSection('basic')}>
        <div className="settings-grid">
          <Field label="페이지명" value={basicDraft.title} disabled={lockedSections.basic || clientAdminMode} onChange={(value) => setBasicDraft((draft) => ({ ...draft, title: value }))} />
          <Field label="페이지 주소" prefix="/" value={basicDraft.slug} disabled={lockedSections.basic || clientAdminMode} onChange={(value) => setBasicDraft((draft) => ({ ...draft, slug: value.replace(/[^a-zA-Z0-9-_]/g, '') }))} />
          {clientAdminMode && <Field label="관리 계정" value={authUser?.email || ''} disabled onChange={() => {}} />}
        </div>
      </SettingsSection>

      {!clientAdminMode && (
        <SettingsSection id="duplicate" title="페이지 복제" openSection={openSection} setOpenSection={setOpenSection} className="page-duplicate-card">
          <div className="page-duplicate-summary">
            <div>
              <strong>유료 기능</strong>
              <p>현재 페이지의 설정, 블록, 스타일, 폼, CTA, 효과, SEO 기본값만 복사합니다. 접수/통계/전송로그/매니저 권한/소유권이전 기록은 복사하지 않습니다.</p>
            </div>
            <button type="button" onClick={() => setDuplicateOpen(true)}>URL 설정</button>
          </div>
          {!canDuplicatePage && (
            <p className="page-duplicate-lock">결제 연동 전까지는 URL 설정 흐름만 확인할 수 있습니다. 템플릿 복제가 아니라 페이지 복제만 유료 기능입니다.</p>
          )}
        </SettingsSection>
      )}

      {!clientAdminMode && (
        <SettingsSection id="duplicatePolicy" title="?? ??? ?? ??" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.duplicatePolicy} onSave={saveDuplicatePolicy} onEdit={editDuplicatePolicy} className="duplicate-policy-card">
          <div className="duplicate-policy-grid">
            <Toggle label="IP ?? ?? ??" checked={!!duplicatePolicyDraft.rejectIpDuplicate} disabled={lockedSections.duplicatePolicy} onChange={(value) => updateDuplicatePolicyDraft({ rejectIpDuplicate: value })} />
            <Toggle label="??? ??? ?? ?? ??" checked={!!duplicatePolicyDraft.rejectCookieDuplicate} disabled={lockedSections.duplicatePolicy} onChange={(value) => updateDuplicatePolicyDraft({ rejectCookieDuplicate: value })} />
            <DuplicateSelect
              label="? ??? ?? ?? ??"
              value={duplicatePolicyDraft.formDuplicateLimitCount}
              disabled={lockedSections.duplicatePolicy}
              options={DUPLICATE_LIMIT_COUNTS}
              onChange={(value) => updateDuplicatePolicyDraft({ formDuplicateLimitCount: value })}
            />
            <DuplicateSelect
              label="? ??? ?? ?? ??"
              value={duplicatePolicyDraft.formDuplicateLimitWindow}
              disabled={lockedSections.duplicatePolicy}
              options={DUPLICATE_LIMIT_WINDOWS}
              onChange={(value) => updateDuplicatePolicyDraft({ formDuplicateLimitWindow: value })}
            />
            <DuplicateSelect
              label="???/??? ??"
              value={duplicatePolicyDraft.phoneEmailMode}
              disabled={lockedSections.duplicatePolicy}
              options={[['mark', '???'], ['warn', '??'], ['block', '??']]}
              onChange={(value) => updateDuplicatePolicyDraft({ phoneEmailMode: value })}
            />
          </div>
          <div className="duplicate-policy-history">
            <div className="duplicate-policy-history-head">
              <div>
                <strong>?? ??</strong>
                <p>??? ?? ??? ??? ??? ?????. IP ??? ???? ????.</p>
              </div>
              <div className="duplicate-policy-history-controls">
                <input
                  type="month"
                  value={blockedHistoryMonth}
                  disabled={blockedHistoryState.loading}
                  onChange={(event) => setBlockedHistoryMonth(event.target.value || currentHistoryMonth())}
                />
                <button type="button" disabled={blockedHistoryState.loading} onClick={loadBlockedHistory}>
                  {blockedHistoryState.loading ? '?? ?' : '????'}
                </button>
              </div>
            </div>
            {blockedHistoryState.error && (
              <span className="duplicate-policy-history-error">{blockedHistoryState.error}</span>
            )}
            {blockedHistoryState.loading ? (
              <span>?? ??? ???? ????.</span>
            ) : displayedBlockedHistory.length === 0 ? (
              <span>??? ?? ??? ????.</span>
            ) : (
              <ul>
                {displayedBlockedHistory.slice(0, 8).map((item, index) => (
                  <li key={item.id || index}>
                    <b>{String(item.date || item.createdAt || '').slice(0, 10) || '?? ??'}</b>
                    <em>{blockedHistoryLabel(item.pageSlug || item.page || item.form || item.formId, '??? ???')}</em>
                    <small>{blockedHistoryReason(item.reason || item.duplicateReason)} ? {blockedHistoryIdentity(item)}</small>
                  </li>
                ))}
              </ul>
            )}
            {blockedHistoryState.total > displayedBlockedHistory.length && (
              <small className="duplicate-policy-history-more">? {blockedHistoryState.total}? ? ?? {displayedBlockedHistory.length}? ??</small>
            )}
          </div>
        </SettingsSection>
      )}

      {canManageProjectUsers && (
        <SettingsSection id="managers" title="매니저 권한" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.managers} onSave={saveManagers} onEdit={editManagers} className="manager-access-card">
          <div className="manager-section-tools">
            <div>
              <p>기본 정보만 먼저 보이고, 상세 권한과 초대 링크는 매니저별로 열어서 관리합니다.</p>
            </div>
            <button type="button" disabled={lockedSections.managers} onClick={addManager}>매니저 추가</button>
          </div>

          <div className="manager-owner-summary compact">
            <div>
              <span>마스터</span>
              <strong>{ownership.ownerEmail || authUser?.email || '미지정'}</strong>
            </div>
            <div>
              <span>클라이언트</span>
              <strong>{ownership.clientEmail || '없음'}</strong>
            </div>
            <button type="button" className="manager-fold-btn" onClick={() => setShowTransfer(!showTransfer)}>소유권이전</button>
          </div>

          {showTransfer && (
            <div className="ownership-transfer-box">
              <div>
                <strong>소유권이전</strong>
                <p>매니저를 선택해 요청하면 내부 관리자가 최종 승인합니다.</p>
              </div>
              <div className="ownership-transfer-controls">
                <select value={transferManagerId} onChange={(event) => setTransferManagerId(event.target.value)} disabled={!eligibleTransferManagers.length}>
                  {!eligibleTransferManagers.length && <option value="">이메일이 입력된 매니저 없음</option>}
                  {eligibleTransferManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>{managerLabel(manager)} · {manager.email}</option>
                  ))}
                </select>
                <button type="button" onClick={requestOwnershipTransferPersisted} disabled={!eligibleTransferManagers.length}>요청</button>
              </div>
              {transferRequest?.status && (
                <div className={`ownership-transfer-status status-${transferRequest.status}`}>
                  <div>
                    <strong>{ownershipTransferStatusLabel(transferRequest.status)}</strong>
                    <span>{transferRequest.managerName || transferRequest.managerEmail || '대상 미지정'} · {ownershipTransferStatusCopy(transferRequest.status)}</span>
                    <small>{ownershipTransferBillingLabel(transferRequest.billingClearanceStatus)} · {transferRequest.requestedAt ? String(transferRequest.requestedAt).slice(0, 10) : '날짜 없음'}</small>
                  </div>
                  {['requested', 'pending-admin-approval'].includes(transferRequest.status) && (
                    <button type="button" onClick={cancelOwnershipTransfer}>취소</button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="manager-list">
            {managerDraft.length === 0 && (
              <div className="manager-empty-state compact">
                <strong>매니저가 없습니다.</strong>
                <p>매니저를 추가한 뒤 메뉴권한 또는 초대만 열어 설정하세요.</p>
                <button type="button" disabled={lockedSections.managers} onClick={addManager}>첫 매니저 추가</button>
              </div>
            )}
            {managerDraft.map((manager, index) => {
              const loading = inviteLoading === (manager.id || manager.email || String(index));
              const inviteUrl = manager.inviteUrl || managerInviteUrl(manager.inviteToken);
              const expanded = expandedManagerId === manager.id;
              const menuExpanded = expandedManagerMenuId === manager.id;
              const disabledManager = manager.status !== 'active';
              return (
                <div className={`manager-card compact ${disabledManager ? 'disabled' : ''}`} key={manager.id || index}>
                  <div className="manager-card-head">
                    <div>
                      <div className="manager-title-row">
                        <strong>{managerLabel(manager)}</strong>
                        <span className={`manager-state-pill ${disabledManager ? 'off' : 'on'}`}>{disabledManager ? '비활성' : '활성'}</span>
                        <span className="manager-state-pill neutral">{managerInviteState(manager, inviteUrl)}</span>
                      </div>
                      <span className="manager-card-summary">{manager.email || '이메일 필요'} · {managerAccessSummary(manager)}</span>
                    </div>
                    <div className="manager-card-actions">
                      <button type="button" onClick={() => setExpandedManagerId(expanded ? '' : manager.id)}>{expanded ? '닫기' : '관리'}</button>
                      {!disabledManager && <button type="button" disabled={lockedSections.managers} onClick={() => disableManager(index)}>비활성 처리</button>}
                      <button type="button" className="danger-btn" disabled={lockedSections.managers} onClick={() => removeManager(index)}>삭제</button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="manager-card-body">
                      <div className="settings-grid">
                        <Field label="이름" value={manager.name} disabled={lockedSections.managers} onChange={(value) => updateManager(index, { name: value })} />
                        <Field label="이메일" value={manager.email} disabled={lockedSections.managers} onChange={(value) => updateManager(index, { email: value.trim().toLowerCase() })} />
                      </div>
                      <div className="manager-subtitle">빠른 권한</div>
                      <div className="manager-preset-row" aria-label="빠른 권한 설정">
                        {MANAGER_ACCESS_PRESETS.map((preset) => (
                          <button type="button" key={preset.id} disabled={lockedSections.managers || disabledManager} onClick={() => setManagerPreset(index, preset)}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="manager-detail-actions">
                        <button type="button" onClick={() => setExpandedManagerMenuId(menuExpanded ? '' : manager.id)}>{menuExpanded ? '메뉴권한 닫기' : '메뉴권한'}</button>
                        <button type="button" onClick={() => (inviteUrl ? copyInvite(manager) : createInvite(manager, index))} disabled={lockedSections.managers || disabledManager || loading}>{loading ? '복사 중' : inviteUrl ? '초대링크 복사' : '초대 링크 만들기'}</button>
                      </div>
                      {menuExpanded && (
                        <div className="manager-permission-panel">
                          <div className="manager-subtitle">메뉴권한</div>
                          <div className="manager-permission-grid">
                            {MANAGER_PERMISSION_TABS.map((permissionTab) => (
                              <div className="manager-permission-row" key={permissionTab}>
                                <strong>{MANAGER_TAB_LABELS[permissionTab]}</strong>
                                <select value={managerPermissionMode(manager, permissionTab)} disabled={lockedSections.managers || disabledManager} onChange={(event) => setManagerPermissionMode(index, permissionTab, event.target.value)}>
                                  <option value="none">권한 없음</option>
                                  <option value="read">보기</option>
                                  <option value="write">편집</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SettingsSection>
      )}

      

      <SettingsSection id="send" title="전송" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.send} onSave={saveSend} onEdit={() => editSection('send')} className="settings-conversion-card">
        <div className="settings-conversion-grid">
          <Toggle label="Webhook 사용" checked={!!sendDraft.webhookEnabled} disabled={lockedSections.send} onChange={(value) => setSendDraft((draft) => ({ ...draft, webhookEnabled: value }))} />
          {sendDraft.webhookEnabled && <Field label="Webhook URL" value={sendDraft.webhookUrl} disabled={lockedSections.send} onChange={(value) => setSendDraft((draft) => ({ ...draft, webhookUrl: value }))} />}
          <Toggle label="자동화 연결" checked={!!sendDraft.automationEnabled} disabled={lockedSections.send} onChange={(value) => setSendDraft((draft) => ({ ...draft, automationEnabled: value }))} />
          {sendDraft.automationEnabled && <Field label="자동화 URL" value={sendDraft.automationUrl} disabled={lockedSections.send} onChange={(value) => setSendDraft((draft) => ({ ...draft, automationUrl: value }))} />}
        </div>
      </SettingsSection>

      {!clientAdminMode && (
        <>
          <SettingsSection id="seo" title="SEO설정" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.seo} onSave={saveSeo} onEdit={() => editSection('seo')}>
            <div className="settings-grid">
              <div className="settings-field-hint-wrap">
                <Field label="메타 제목" value={seoDraft.title} disabled={lockedSections.seo} placeholder="강남 피부관리 상담 예약 | 브랜드명" onChange={(value) => setSeoDraft((draft) => ({ ...draft, title: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="메타 설명" textarea value={seoDraft.desc} disabled={lockedSections.seo} placeholder="무료 상담, 방문 예약, 혜택을 80자 안팎으로 요약" onChange={(value) => setSeoDraft((draft) => ({ ...draft, desc: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <ImageInput label="파비콘" value={seoDraft.favicon} disabled={lockedSections.seo} onChange={(value) => setSeoDraft((draft) => ({ ...draft, favicon: value }))} />
                <small className="settings-field-hint">32x32 PNG/ICO</small>
              </div>
              <div className="settings-field-hint-wrap">
                <ImageInput label="공유 이미지" value={seoDraft.og} disabled={lockedSections.seo} onChange={(value) => setSeoDraft((draft) => ({ ...draft, og: value }))} />
                <small className="settings-field-hint">1200x630 JPG/PNG/WebP</small>
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="네이버 웹마스터" value={seoDraft.naverWebmaster} disabled={lockedSections.seo} placeholder="naver-site-verification content 값" onChange={(value) => setSeoDraft((draft) => ({ ...draft, naverWebmaster: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="구글 콘솔" value={seoDraft.console} disabled={lockedSections.seo} placeholder="google-site-verification content 값" onChange={(value) => setSeoDraft((draft) => ({ ...draft, console: value }))} />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection id="tracking" title="추적 코드" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.tracking} onSave={saveTracking} onEdit={() => editSection('tracking')}>
            <div className="settings-grid">
              <div className="settings-field-hint-wrap">
                <Field label="GTM" value={trackingDraft.gtm} disabled={lockedSections.tracking} placeholder="GTM-XXXXXXX" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, gtm: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="GA4" value={trackingDraft.ga4} disabled={lockedSections.tracking} placeholder="G-XXXXXXXXXX" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, ga4: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="Google Ads 태그" value={trackingDraft.googleAdsTag} disabled={lockedSections.tracking} placeholder="AW-123456789" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, googleAdsTag: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="Meta Pixel" value={trackingDraft.pixel} disabled={lockedSections.tracking} placeholder="123456789012345" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, pixel: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="네이버 WCS" value={trackingDraft.naver} disabled={lockedSections.tracking} placeholder="s_abcdef1234" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, naver: value }))} />
              </div>
              <div className="settings-field-hint-wrap">
                <Field label="카카오 픽셀" value={trackingDraft.kakao} disabled={lockedSections.tracking} placeholder="카카오 픽셀 ID" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, kakao: value }))} />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection id="conversion" title="전환 추적" openSection={openSection} setOpenSection={setOpenSection} className="settings-conversion-card">
            <div className="settings-conversion-grid">
              <div className="settings-full settings-conversion-values" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 950 }}>Google Ads 전환코드</span>
                  <textarea
                    value={page.meta.ads || ''}
                    disabled={conversionLocked}
                    onChange={(event) => updateConversionMeta({ ads: event.target.value })}
                    placeholder="AW-123456789/AbCdEf"
                    style={{ boxSizing: 'border-box', width: '100%', minHeight: 96, resize: 'vertical' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 950 }}>Meta Pixel ID</span>
                  <input
                    value={page.meta.pixel || ''}
                    disabled={conversionLocked}
                    onChange={(event) => updateConversionMeta({ pixel: event.target.value })}
                    placeholder="123456789012345"
                    style={{ boxSizing: 'border-box', width: '100%' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 950 }}>네이버 전환 ID</span>
                  <input
                    value={page.meta.naver || ''}
                    disabled={conversionLocked}
                    onChange={(event) => updateConversionMeta({ naver: event.target.value })}
                    placeholder="s_abcdef1234"
                    style={{ boxSizing: 'border-box', width: '100%' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 950 }}>카카오 픽셀 ID</span>
                  <input
                    value={page.meta.kakao || ''}
                    disabled={conversionLocked}
                    onChange={(event) => updateConversionMeta({ kakao: event.target.value })}
                    placeholder="987654321"
                    style={{ boxSizing: 'border-box', width: '100%' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {conversionLocked ? (
                    <button type="button" className="test-connection-btn" onClick={() => setConversionLocked(false)}>수정</button>
                  ) : (
                    <button type="button" className="save-connection-btn" disabled={!hasConversionValue} onClick={saveConversionValues}>저장</button>
                  )}
                </div>
              </div>
              {showConversionToggles && (
                <>
                  <Toggle label="전환 추적 사용" checked={!!integrations.conversion.enabled} onChange={(value) => updateIntegrations('conversion', { enabled: value })} />
                  <div className="settings-full settings-conversion-help">
                    dataLayer는 별도 ID 없이 이벤트만 전송합니다. 접수 성공 시 <code>lead_submit</code>, 방문예약 성공 시 <code>reservation_submit</code> 이벤트를 전송합니다.
                  </div>
                  <Toggle label="dataLayer" checked={!!integrations.conversion.dataLayer} onChange={(value) => updateIntegrations('conversion', { dataLayer: value })} />
                  {conversionReady.pixel && <Toggle label="Meta Pixel" checked={!!integrations.conversion.metaPixel} onChange={(value) => updateIntegrations('conversion', { metaPixel: value })} />}
                  {conversionReady.ads && <Toggle label="Google Ads" checked={!!integrations.conversion.googleAds} onChange={(value) => updateIntegrations('conversion', { googleAds: value })} />}
                  {conversionReady.naver && <Toggle label="네이버" checked={!!integrations.conversion.naver} onChange={(value) => updateIntegrations('conversion', { naver: value })} />}
                  {conversionReady.kakao && <Toggle label="카카오" checked={!!integrations.conversion.kakao} onChange={(value) => updateIntegrations('conversion', { kakao: value })} />}
                </>
              )}
            </div>
          </SettingsSection>
        </>
      )}

      {!clientAdminMode && (
        <SettingsSection id="reset" title="초기화" openSection={openSection} setOpenSection={setOpenSection} className="danger-zone">
          <button className="reset-danger" onClick={onReset}>전체 데이터 초기화</button>
        </SettingsSection>
      )}
      {duplicateOpen && (
        <div className="settings-modal-backdrop" role="presentation">
          <section className="settings-url-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-url-title">
            <div className="settings-url-modal-head">
              <div>
                <span>페이지 복제</span>
                <h2 id="duplicate-url-title">URL 설정</h2>
              </div>
              <button type="button" onClick={() => setDuplicateOpen(false)} aria-label="닫기">닫기</button>
            </div>

            <div className="settings-url-choice" role="group" aria-label="도메인 선택">
              <button type="button" className={duplicateDraft.domainType === 'default' ? 'active' : ''} onClick={() => setDuplicateField('domainType', 'default')}>기본 제공 도메인</button>
              <button type="button" className={duplicateDraft.domainType === 'custom' ? 'active' : ''} onClick={() => setDuplicateField('domainType', 'custom')}>개인 도메인</button>
            </div>

            <div className="settings-url-form">
              <label>
                <span>URL 경로</span>
                <input value={duplicateDraft.slug} onChange={(event) => setDuplicateField('slug', event.target.value)} placeholder="new-page" />
              </label>
              {duplicateDraft.domainType === 'custom' && (
                <label>
                  <span>개인 도메인</span>
                  <input value={duplicateDraft.customDomain} onChange={(event) => setDuplicateField('customDomain', event.target.value)} placeholder="landing.example.com" />
                  <small>저장 후 DNS 확인 대기 상태로 기록됩니다.</small>
                </label>
              )}
            </div>

            {duplicateIssues.length > 0 && <p className="settings-url-error">{duplicateIssues[0]}</p>}
            {!canDuplicatePage && <p className="settings-url-lock">유료 기능 잠금 상태입니다. 결제 기능이 연결되면 이 URL 설정으로 페이지 복제를 진행합니다.</p>}

            <div className="settings-url-modal-actions">
              <button type="button" onClick={() => setDuplicateOpen(false)}>취소</button>
              <button type="button" className="primary" disabled={duplicateBlocked} onClick={requestPageDuplicate}>페이지 복제</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
