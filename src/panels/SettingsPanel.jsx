import { useMemo, useState } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { Field, ImageInput, Toggle } from '../editor/controls.jsx';
import {
  DEFAULT_MANAGER_ACCESS,
  MANAGER_PERMISSION_TABS,
  isClientAdminMode,
  isManagerMode,
  normalizeManagerAccount,
  normalizeOwnershipSettings,
} from '../lib/authContext.js';
import { createLocalManagerInvite, createServerManagerInvite, createServerOwnershipTransfer, managerInviteUrl } from '../lib/managerInvites.js';
import { ownershipTransferBillingLabel, ownershipTransferStatusCopy, ownershipTransferStatusLabel } from '../lib/ownershipTransfer.js';
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

export default function SettingsPanel({
  page,
  updatePage,
  updateMeta,
  updateIntegrations,
  onReset,
  authUser = null,
  accessMode = 'builder',
}) {
  const integrations = normalizeIntegrations(page.integrations || {});
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
  const [openSection, setOpenSection] = useState('basic');
  const [lockedSections, setLockedSections] = useState({ basic: false, managers: false, send: false, seo: false, tracking: false });
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
  const saveManagers = () => {
    updateOwnership({ managers: managerDraft.map(normalizeManagerAccount) });
    lockSection('managers');
    notify('매니저 권한을 저장했습니다.', 'success');
  };
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

  const toggleManagerDisabled = (index) => {
    const current = managerDraft[index];
    updateManager(index, { status: current?.status === 'active' ? 'disabled' : 'active' });
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

  return (
    <div className="simple-panel settings-panel">
      <SettingsSection id="basic" title="페이지 기본" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.basic} onSave={saveBasic} onEdit={() => editSection('basic')}>
        <div className="settings-grid">
          <Field label="페이지명" value={basicDraft.title} disabled={lockedSections.basic || clientAdminMode} onChange={(value) => setBasicDraft((draft) => ({ ...draft, title: value }))} />
          <Field label="페이지 주소" prefix="/" value={basicDraft.slug} disabled={lockedSections.basic || clientAdminMode} onChange={(value) => setBasicDraft((draft) => ({ ...draft, slug: value.replace(/[^a-zA-Z0-9-_]/g, '') }))} />
          {clientAdminMode && <Field label="관리 계정" value={authUser?.email || ''} disabled onChange={() => {}} />}
        </div>
      </SettingsSection>

      {canManageProjectUsers && (
        <SettingsSection id="managers" title="매니저 권한" openSection={openSection} setOpenSection={setOpenSection} locked={lockedSections.managers} onSave={saveManagers} onEdit={editManagers} className="manager-access-card">
          <div className="manager-section-tools">
            <div>
              <p>필요한 항목만 열어서 관리합니다.</p>
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
                      <strong>{managerLabel(manager)}</strong>
                      <span>{manager.email || '이메일 필요'} · {managerAccessSummary(manager)}</span>
                    </div>
                    <div className="manager-card-actions">
                      <button type="button" onClick={() => setExpandedManagerId(expanded ? '' : manager.id)}>{expanded ? '접기' : '설정'}</button>
                      <button type="button" disabled={lockedSections.managers} onClick={() => toggleManagerDisabled(index)}>{disabledManager ? '활성' : '비활성'}</button>
                      <button type="button" className="danger-btn" disabled={lockedSections.managers} onClick={() => removeManager(index)}>삭제</button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="manager-card-body">
                      <div className="settings-grid">
                        <Field label="이름" value={manager.name} disabled={lockedSections.managers} onChange={(value) => updateManager(index, { name: value })} />
                        <Field label="이메일" value={manager.email} disabled={lockedSections.managers} onChange={(value) => updateManager(index, { email: value.trim().toLowerCase() })} />
                      </div>
                      <div className="manager-preset-row" aria-label="빠른 권한 설정">
                        {MANAGER_ACCESS_PRESETS.map((preset) => (
                          <button type="button" key={preset.id} disabled={lockedSections.managers || disabledManager} onClick={() => setManagerPreset(index, preset)}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="manager-detail-actions">
                        <button type="button" onClick={() => setExpandedManagerMenuId(menuExpanded ? '' : manager.id)}>{menuExpanded ? '메뉴권한 닫기' : '메뉴권한'}</button>
                        <button type="button" onClick={() => (inviteUrl ? copyInvite(manager) : createInvite(manager, index))} disabled={lockedSections.managers || disabledManager || loading}>{loading ? '복사 중' : '초대'}</button>
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
    </div>
  );
}
