import { useEffect, useMemo, useState } from 'react';
import { normalizeIntegrations } from '../lib/pageModel.js';
import {
  connectionCounts,
  connectionState,
  deliveryStatusLabel,
  isValidEmail,
  runConnectionTest,
  serviceLabel,
} from '../lib/leadIntegrations.js';
import {
  fmtDate,
  LEAD_STATUS,
  leadKind,
  leadKindLabel,
  leadPrimaryContact,
  leadSearchText,
  normalizeLeadItem,
  statusClass,
} from '../lib/leadModel.js';
import { currentMonthValue, monthDateRange } from '../lib/monthRange.js';
import './InboxPanel.css';

function leadTime(lead = {}) {
  const time = new Date(lead.createdAt || lead.savedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function leadInDateRange(lead = {}, range = {}) {
  const time = leadTime(lead);
  if (!time) return false;
  if (range.dateFrom && time < new Date(`${range.dateFrom}T00:00:00`).getTime()) return false;
  if (range.dateTo && time > new Date(`${range.dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

function ConnectionStatus({ state }) {
  return <em className={`connection-status ${state.tone}`}>{state.text}</em>;
}

function MiniToggle({ active, children, onClick }) {
  return <button type="button" className={`mini-toggle ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

function ConnectionToggleRow({ label, checked, onChange }) {
  return (
    <div className="connection-inline-control">
      <span>{label}</span>
      <button type="button" className={`inline-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>{checked ? 'ON' : 'OFF'}</button>
    </div>
  );
}

function ConnectionInputRow({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="connection-inline-control">
      <span>{label}</span>
      <input value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ConnectionChoiceRow({ label, value, onChange, options }) {
  return (
    <div className="connection-inline-control">
      <span>{label}</span>
      <div className="inline-chip-row">
        {options.map(([key, text]) => <MiniToggle key={key} active={value === key} onClick={() => onChange(key)}>{text}</MiniToggle>)}
      </div>
    </div>
  );
}

function ConnectionItem({ title, state, opened, onOpen, children, summary, actions }) {
  return (
    <div className={`connection-item connect-v4 ${opened ? 'open' : ''}`}>
      <div className="connection-row">
        <button type="button" className="connection-row-main" onClick={onOpen}>
          <strong>{title}</strong>
          {summary && <small>{summary}</small>}
        </button>
        <ConnectionStatus state={state} />
        <button type="button" className="connection-row-edit" onClick={onOpen}>{opened ? '닫기' : '설정'}</button>
      </div>
      {opened && (
        <div className="connection-detail-box compact">
          {children}
          {actions && <div className="connection-save-actions">{actions}</div>}
        </div>
      )}
    </div>
  );
}

function connectionTitle(type) {
  const map = { internal: '내부 접수함', google: 'Google 연결', email: '이메일 알림', webhook: 'Webhook', automation: '자동화 서비스', calendar: '캘린더 연결' };
  return map[type] || '연결';
}

function InboxConnectionsPanel({ page, updateIntegrations }) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState('');
  const counts = useMemo(() => connectionCounts(integrations), [integrations]);
  const states = useMemo(() => ({
    internal: connectionState('internal', integrations),
    google: connectionState('google', integrations),
    email: connectionState('email', integrations),
    webhook: connectionState('webhook', integrations),
    automation: connectionState('automation', integrations),
    calendar: connectionState('calendar', integrations),
  }), [integrations]);

  const setIntegration = (section, patch) => updateIntegrations(section, patch);
  const openItem = (type) => {
    setOpen(true);
    setActive((value) => value === type ? '' : type);
    setResult(null);
  };
  const saveSection = (type) => {
    setResult({ type, ok: true, message: `${connectionTitle(type)} 설정을 저장했습니다.` });
    setActive('');
  };
  const test = async (type) => {
    setTesting(type);
    setResult(null);
    try {
      const res = await runConnectionTest(type, page);
      setResult({ type, ...res });
    } catch (error) {
      setResult({ type, ok: false, message: `테스트 실패: ${String(error?.message || error)}` });
    } finally {
      setTesting('');
    }
  };

  const SaveButton = ({ type, label = '저장', disabled = false }) => <button type="button" className="save-connection-btn" disabled={disabled} onClick={() => saveSection(type)}>{label}</button>;
  const TestButton = ({ type, children = '테스트' }) => <button type="button" className="test-connection-btn" onClick={() => test(type)} disabled={!!testing}>{testing === type ? '확인 중' : children}</button>;
  const emailSummary = integrations.email.enabled
    ? `${integrations.email.to || '이메일 미입력'} · ${[integrations.email.consult !== false ? '상담접수' : '', integrations.email.reservation !== false ? '방문예약' : ''].filter(Boolean).join(', ') || '알림 유형 없음'}`
    : '꺼짐';
  const webhookSummary = integrations.webhook.enabled ? `${serviceLabel(integrations.webhook.service || 'custom')} · ${integrations.webhook.url || 'URL 미입력'}` : '꺼짐';
  const automationSummary = integrations.automation.enabled ? `${serviceLabel(integrations.automation.service || 'make')} · ${integrations.automation.url || 'URL 미입력'}` : '꺼짐';

  return (
    <section className={`card inbox-connect-card easy-mode v4 ${open ? 'open' : ''}`}>
      <button className="inbox-connect-head" type="button" onClick={() => setOpen(!open)}>
        <div><h2>외부 전송</h2></div>
        <div className="connect-head-right">
          <span>{counts.ok}개 사용중</span>
          {counts.warn > 0 && <i>{counts.warn}개 확인필요</i>}
          <b>{open ? '닫기' : '설정'}</b>
        </div>
      </button>

      {open && (
        <div className="inbox-connect-body">
          <div className="connect-summary-strip line-summary">
            <div><strong>{counts.ok}</strong><span>사용중</span></div>
            <div><strong>{counts.warn}</strong><span>확인필요</span></div>
            <div><strong>{counts.ready}</strong><span>준비중</span></div>
          </div>

          {result && <div className={`connection-result ${result.ok ? 'ok' : 'warn'}`}><strong>{result.ok ? '확인 완료' : '확인 필요'}</strong><span>{result.message}</span></div>}

          <div className="connection-group-title">기본 저장</div>
          <ConnectionItem title="내부 접수함" state={states.internal} opened={active === 'internal'} onOpen={() => openItem('internal')} summary="항상 사용" actions={<><SaveButton type="internal" /><TestButton type="internal">저장 확인</TestButton></>}>
            <div className="connection-form-box compact-line"><div className="connection-inline-control readonly"><span>상태</span><b>항상 저장</b></div></div>
          </ConnectionItem>

          <div className="connection-group-title">Google 시트 저장</div>
          <ConnectionItem title="Google로 연결하기" state={states.google} opened={active === 'google'} onOpen={() => openItem('google')} summary={integrations.google.connected ? integrations.google.email : '서버 배포 후 활성화'} actions={<><SaveButton type="google" disabled /><button type="button" className="connect-main-btn" disabled>Google 연결</button><TestButton type="google">준비 확인</TestButton></>}>
            <div className="connection-form-box compact-line"><div className="connection-inline-control readonly"><span>상태</span><b>준비중</b></div></div>
          </ConnectionItem>

          <div className="connection-group-title">알림</div>
          <ConnectionItem title="이메일 알림" state={states.email} opened={active === 'email'} onOpen={() => openItem('email')} summary={emailSummary} actions={<><SaveButton type="email" /><button type="button" className="test-connection-btn" disabled={!integrations.email.enabled || !isValidEmail(integrations.email.to)}>인증 메일</button><TestButton type="email">설정 확인</TestButton></>}>
            <div className="connection-form-box compact-line">
              <ConnectionToggleRow label="이메일 알림" checked={!!integrations.email.enabled} onChange={(value) => setIntegration('email', { enabled: value })} />
              {integrations.email.enabled && <>
                <ConnectionInputRow label="받을 이메일" value={integrations.email.to || ''} onChange={(value) => setIntegration('email', { to: value })} placeholder="example@email.com" />
                <div className="connection-inline-control"><span>알림 유형</span><div className="inline-chip-row"><MiniToggle active={integrations.email.consult !== false} onClick={() => setIntegration('email', { consult: !(integrations.email.consult !== false) })}>상담접수</MiniToggle><MiniToggle active={integrations.email.reservation !== false} onClick={() => setIntegration('email', { reservation: !(integrations.email.reservation !== false) })}>방문예약</MiniToggle></div></div>
                <div className="connection-inline-control readonly"><span>사용 한도</span><b>무료 1개 · 유료 5개</b></div>
              </>}
            </div>
          </ConnectionItem>

          <div className="connection-group-title">외부 전송</div>
          <ConnectionItem title="Webhook" state={states.webhook} opened={active === 'webhook'} onOpen={() => openItem('webhook')} summary={webhookSummary} actions={<><SaveButton type="webhook" /><TestButton type="webhook">테스트 전송</TestButton></>}>
            <div className="connection-form-box compact-line">
              <ConnectionToggleRow label="Webhook 사용" checked={!!integrations.webhook.enabled} onChange={(value) => setIntegration('webhook', { enabled: value })} />
              {integrations.webhook.enabled && <>
                <ConnectionChoiceRow label="연결 대상" value={integrations.webhook.service || 'custom'} onChange={(value) => setIntegration('webhook', { service: value })} options={[['custom', '직접'], ['crm', 'CRM'], ['server', '서버']]} />
                <ConnectionInputRow label="전송 URL" value={integrations.webhook.url || ''} onChange={(value) => setIntegration('webhook', { url: value })} placeholder="https://..." />
              </>}
            </div>
          </ConnectionItem>

          <ConnectionItem title="자동화 서비스" state={states.automation} opened={active === 'automation'} onOpen={() => openItem('automation')} summary={automationSummary} actions={<><SaveButton type="automation" /><TestButton type="automation">테스트 전송</TestButton></>}>
            <div className="connection-form-box compact-line">
              <ConnectionToggleRow label="자동화 연결" checked={!!integrations.automation.enabled} onChange={(value) => setIntegration('automation', { enabled: value })} />
              {integrations.automation.enabled && <>
                <ConnectionChoiceRow label="서비스" value={integrations.automation.service || 'make'} onChange={(value) => setIntegration('automation', { service: value })} options={[['make', 'Make'], ['zapier', 'Zapier'], ['n8n', 'n8n']]} />
                <ConnectionInputRow label="자동화 URL" value={integrations.automation.url || ''} onChange={(value) => setIntegration('automation', { url: value })} placeholder="https://..." />
              </>}
            </div>
          </ConnectionItem>

          <div className="connection-group-title">예약</div>
          <ConnectionItem title="캘린더 연결" state={states.calendar} opened={active === 'calendar'} onOpen={() => openItem('calendar')} summary="방문예약 자동 등록" actions={<><SaveButton type="calendar" disabled /><TestButton type="calendar">준비 확인</TestButton></>}>
            <div className="connection-form-box compact-line"><div className="connection-inline-control readonly"><span>상태</span><b>준비중</b></div></div>
          </ConnectionItem>
        </div>
      )}
    </section>
  );
}

function StatusPills({ value, onChange }) {
  return (
    <div className="status-pill-row">
      {LEAD_STATUS.map((item) => (
        <button key={item} type="button" className={value === item ? 'active' : ''} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function LeadInfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="lead-info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function fmtDateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR');
}

function DebouncedMemoInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  useEffect(() => {
    if ((value || '') === draft) return undefined;
    const timer = window.setTimeout(() => onCommit(draft), 650);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit, value]);

  return (
    <input
      placeholder="내부 메모를 입력하세요"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if ((value || '') !== draft) onCommit(draft);
      }}
    />
  );
}

function LeadConflictNotice({ conflict, onReload, onRetry, onDismiss }) {
  if (!conflict) return null;
  const actionText = conflict.action === 'delete' ? '삭제' : '저장';
  const latestTime = conflict.latest?.updatedAt || conflict.latest?.savedAt || conflict.latest?.createdAt || '';
  return (
    <section className="lead-conflict-notice" role="status">
      <div>
        <strong>접수 데이터 {actionText} 충돌</strong>
        <span>{conflict.message || '다른 화면에서 먼저 수정된 접수 데이터입니다.'}</span>
        {latestTime && <small>서버 기준 시간: {fmtDate(latestTime)}</small>}
      </div>
      <div className="lead-conflict-actions">
        <button type="button" onClick={onReload}>최신 목록 불러오기</button>
        <button type="button" onClick={onRetry}>{conflict.action === 'delete' ? '삭제 다시 시도' : '내 변경 다시 시도'}</button>
        <button type="button" className="ghost" onClick={onDismiss}>닫기</button>
      </div>
    </section>
  );
}

export default function InboxPanel({ leads, page, syncing = false, totalLeads = 0, hasMoreLeads = false, loadMoreLeads, onFiltersChange, updateIntegrations, updateLead, deleteLead, retryLeadDelivery, retryFailedDeliveries, exportLeadsCsv, leadConflict, onReloadLeadConflict, onRetryLeadConflict, onDismissLeadConflict }) {
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(currentMonthValue());
  const [openId, setOpenId] = useState('');
  const updateLeadSafe = updateLead || (() => {});
  const selectedMonthRange = useMemo(() => monthDateRange(month), [month]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onFiltersChange?.({ kind: filter, status: statusFilter, q: query.trim(), month });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filter, month, onFiltersChange, query, statusFilter]);

  const { normalized, consultCount, reservationCount, newCount, failedDeliveryCount, filtered } = useMemo(() => {
    const items = (leads || []).map(normalizeLeadItem);
    const q = query.trim().toLowerCase();
    let consult = 0;
    let reservation = 0;
    let fresh = 0;
    let failed = 0;
    const visible = [];

    items.forEach((lead) => {
      const kind = leadKind(lead);
      if (!leadInDateRange(lead, selectedMonthRange)) return;
      if (kind === 'reservation') reservation += 1;
      else consult += 1;
      if (lead.status === '신규') fresh += 1;
      if (['failed', 'partial'].includes(lead.delivery?.status)) failed += 1;
      if (filter !== 'all' && kind !== filter) return;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return;
      if (deliveryFilter === 'needs-attention' && !['failed', 'partial'].includes(lead.delivery?.status)) return;
      if (deliveryFilter !== 'all' && deliveryFilter !== 'needs-attention' && lead.delivery?.status !== deliveryFilter) return;
      if (q && !leadSearchText(lead).includes(q)) return;
      visible.push(lead);
    });

    return { normalized: items, consultCount: consult, reservationCount: reservation, newCount: fresh, failedDeliveryCount: failed, filtered: visible };
  }, [deliveryFilter, filter, leads, query, selectedMonthRange, statusFilter]);

  return (
    <div className="simple-panel inbox-panel inbox-v2 inbox-v3">
      <section className="inbox-summary-v2 inbox-summary-v3">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          <span>전체</span><strong>{normalized.length}건</strong><small>신규 {newCount}건</small>
        </button>
        <button className={filter === 'consult' ? 'active' : ''} onClick={() => setFilter('consult')}>
          <span>상담</span><strong>{consultCount}건</strong><small>상담 접수</small>
        </button>
        <button className={filter === 'reservation' ? 'active' : ''} onClick={() => setFilter('reservation')}>
          <span>예약</span><strong>{reservationCount}건</strong><small>방문 예약</small>
        </button>
      </section>

      <LeadConflictNotice conflict={leadConflict} onReload={onReloadLeadConflict} onRetry={onRetryLeadConflict} onDismiss={onDismissLeadConflict} />

      <section className="card inbox-toolbar-card inbox-toolbar-v3">
        <div className="inbox-toolbar">
          <div className="inbox-search">
            <span>검색</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 연락처, 메모, 답변 검색" />
          </div>
          <div className="inbox-status-filter">
            <span>월</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} />
          </div>
          <div className="inbox-status-filter">
            <span>상태</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">전체</option>
              {LEAD_STATUS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="inbox-status-filter">
            <span>전송</span>
            <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}>
              <option value="all">전체</option>
              <option value="needs-attention">확인 필요</option>
              <option value="success">성공</option>
              <option value="partial">일부 실패</option>
              <option value="failed">실패</option>
              <option value="pending">진행 중</option>
              <option value="none">없음</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card inbox-list-card inbox-list-v3">
        <div className="section-title inbox-list-title">
          <div>
            <h2>접수 DB</h2>
            <p>{filtered.length}건 표시 중{failedDeliveryCount ? ` · 전송 확인 ${failedDeliveryCount}건` : ''}</p>
          </div>
          <div className="inbox-list-actions">
            {failedDeliveryCount > 0 && <button type="button" className="danger" onClick={retryFailedDeliveries}>실패 재전송</button>}
            {hasMoreLeads && <button type="button" disabled={syncing} onClick={loadMoreLeads}>{syncing ? '불러오는 중' : `더보기 ${normalized.length}/${totalLeads || normalized.length}`}</button>}
            <button type="button" disabled={!filtered.length} onClick={() => exportLeadsCsv?.(filtered, { month, kind: filter, status: statusFilter, deliveryStatus: deliveryFilter, q: query.trim() })}>CSV</button>
            <button type="button" onClick={() => { setFilter('all'); setStatusFilter('all'); setDeliveryFilter('all'); setQuery(''); }}>초기화</button>
          </div>
        </div>

        {syncing && <div className="inbox-sync-note">서버 접수 데이터를 불러오는 중입니다.</div>}

        {!filtered.length ? <div className="empty">조건에 맞는 접수 데이터가 없습니다.</div> : (
          <div className="lead-list-v3">
            {filtered.map((lead, index) => {
              const opened = openId === lead.id;
              const answers = Array.isArray(lead.answers) ? lead.answers : [];
              const history = Array.isArray(lead.history) ? lead.history.slice().reverse() : [];
              return (
                <article className={`lead-card-v3 ${opened ? 'open' : ''}`} key={lead.id}>
                  <div className="lead-row-v3">
                    <button className="lead-row-main-v3" type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>
                      <span className={`lead-kind-pill ${leadKind(lead)}`}>#{index + 1} {leadKindLabel(lead)}</span>
                      <strong>{lead.name || '이름 없음'}</strong>
                      <em>{leadPrimaryContact(lead)}</em>
                    </button>

                    <div className="lead-row-meta-v3">
                      {lead.duplicate && <b className="lead-status hold">중복</b>}
                      {lead.duplicateReason?.includes('spam_suspected') && <b className="lead-status hold">스팸의심</b>}
                      <b className={`lead-status ${statusClass(lead.status)}`}>{lead.status}</b>
                      <small>{fmtDateOnly(lead.createdAt)}</small>
                      <button type="button" onClick={() => setOpenId(opened ? '' : lead.id)}>{opened ? '닫기' : '상세'}</button>
                    </div>
                  </div>

                  {opened && (
                    <div className="lead-detail-v3">
                      <section className="lead-detail-section">
                        <h3>고객 정보</h3>
                        <div className="lead-info-grid">
                          <LeadInfoRow label="신청 유형" value={lead.type} />
                          <LeadInfoRow label="신청 시간" value={fmtDate(lead.createdAt)} />
                          <LeadInfoRow label="이름" value={lead.name || '-'} />
                          <LeadInfoRow label="연락처" value={lead.phone || '-'} />
                          <LeadInfoRow label="이메일" value={lead.email} />
                          <LeadInfoRow label="주소" value={lead.address} />
                        </div>
                      </section>

                      {lead.message && (
                        <section className="lead-detail-section">
                          <h3>문의 내용</h3>
                          <div className="lead-message-box">{lead.message}</div>
                        </section>
                      )}

                      {!!answers.length && (
                        <section className="lead-detail-section">
                          <h3>질문 답변</h3>
                          <div className="lead-answer-list-v3">
                            {answers.map((answer) => (
                              <div key={answer.id || answer.label}>
                                <span>{answer.label}</span>
                                <b>{Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-')}</b>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      <section className="lead-detail-section">
                        <h3>외부 전송</h3>
                        <div className="lead-info-grid">
                          <LeadInfoRow label="상태" value={deliveryStatusLabel(lead.delivery?.status)} />
                          <LeadInfoRow label="요약" value={lead.delivery?.summary || '외부 전송 없음'} />
                          {['failed', 'partial'].includes(lead.delivery?.status) && (
                            <button type="button" onClick={() => retryLeadDelivery?.(lead)}>재전송</button>
                          )}
                        </div>
                        {!!(lead.delivery?.logs || []).length && (
                          <div className="lead-answer-list-v3">
                            {(lead.delivery.logs || []).map((log, idx) => (
                              <div key={`${log.target}-${idx}`}>
                                <span>{log.target || '전송 대상'}</span>
                                <b>{`${log.status === 'success' ? '성공' : '실패'} · ${log.message || '-'}`}</b>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="lead-detail-section lead-manage-section">
                        <h3>관리</h3>
                        <StatusPills value={lead.status} onChange={(status) => updateLeadSafe(lead.id, { status })} />
                        <label className="lead-memo-v3">
                          <span>메모</span>
                          <DebouncedMemoInput value={lead.memo || ''} onCommit={(memo) => updateLeadSafe(lead.id, { memo })} />
                        </label>
                        <button className="delete delete-v3" onClick={() => deleteLead?.(lead.id)}>삭제</button>
                      </section>

                      {!!history.length && (
                        <section className="lead-detail-section">
                          <h3>변경 이력</h3>
                          <div className="lead-history-list">
                            {history.slice(0, 8).map((item, idx) => (
                              <div key={item.id || `${item.at}-${idx}`}>
                                <span>{item.type === 'status' ? '상태' : '메모'}</span>
                                <b>{item.type === 'status' ? `${item.from || '-'} → ${item.to || '-'}` : '메모 수정'}</b>
                                <small>{fmtDate(item.at)}</small>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <InboxConnectionsPanel page={page} updateIntegrations={updateIntegrations} />
    </div>
  );
}
