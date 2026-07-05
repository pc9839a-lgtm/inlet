import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeIntegrations } from '../../lib/pageModel.js';
import { connectionCounts, connectionState, runConnectionTest } from '../../lib/leadIntegrations.js';
import { apiFetch, postJson, projectAuthHeaders } from '../../lib/apiClient.js';
import { projectContext } from '../../lib/projectContext.js';
import { GOOGLE_SHEETS_APPS_SCRIPT } from './googleSheetsSample.js';
import {
  collectGoogleSheetHeaders,
  enforceFreeEmailIntegration,
  isFreeEmailLocked,
  lockedAccountEmail,
} from './leadHelpers.js';

function MiniToggle({ active, children, onClick }) {
  return (
    <button type="button" className={`mini-toggle ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function InlineSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={`inline-switch ${checked ? 'on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  );
}

function resultIsOk(result) {
  return result && !/(실패|오류|error|failed|not defined|권한|응답 실패|URL 확인|입력해주세요)/i.test(result);
}

export default function InboxConnectionsPanel({ page, authUser = null, updateIntegrations, onSavePage }) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const emailLocked = isFreeEmailLocked(page, authUser);
  const accountEmail = lockedAccountEmail(authUser, page, integrations);
  const [draftIntegrations, setDraftIntegrations] = useState(() => enforceFreeEmailIntegration(integrations, page, authUser));
  const [draftDirty, setDraftDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [result, setResult] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const counts = useMemo(() => connectionCounts(draftIntegrations), [draftIntegrations]);
  const emailState = connectionState('email', draftIntegrations);
  const sheetsState = connectionState('sheets', draftIntegrations);
  const webhookState = connectionState('webhook', draftIntegrations);

  useEffect(() => {
    if (!draftDirty) setDraftIntegrations(enforceFreeEmailIntegration(integrations, page, authUser));
  }, [page.slug, page.updatedAt, authUser?.email, draftDirty]);

  useEffect(() => {
    if (!emailLocked) return;
    setDraftIntegrations((current) => {
      const next = enforceFreeEmailIntegration(current, page, authUser);
      if ((current.email?.to || '') === (next.email?.to || '') && current.email?.lockedToAccount === true) return current;
      return next;
    });
    const enforced = enforceFreeEmailIntegration(integrations, page, authUser);
    if (enforced.email?.to && ((integrations.email?.to || '') !== enforced.email.to || integrations.email?.lockedToAccount !== true)) {
      updateIntegrations?.('email', enforced.email);
    }
  }, [emailLocked, accountEmail, page.slug]);

  const googleSheetsProject = () => {
    const context = projectContext(page, authUser);
    return {
      ...context,
      id: context.projectId,
      title: page.title || '',
    };
  };

  const googleSheetsHeaders = () => collectGoogleSheetHeaders(page);

  const draftPatch = (section, value) => {
    const currentSection = draftIntegrations?.[section] || {};
    const nextSection = { ...currentSection, ...value };
    const nextIntegrations = enforceFreeEmailIntegration({ ...draftIntegrations, [section]: nextSection }, page, authUser);
    setDraftIntegrations(nextIntegrations);
    setDraftDirty(true);
    return nextIntegrations;
  };

  const patch = (section, value) => {
    const nextIntegrations = draftPatch(section, value);
    updateIntegrations?.(section, nextIntegrations[section]);
  };

  const sheetPatch = (value) => {
    const nextIntegrations = draftPatch('sheets', value);
    updateIntegrations?.('sheets', nextIntegrations.sheets);
    return nextIntegrations;
  };

  const switchSheetsMode = (mode) => {
    const nextMode = mode === 'webhook' ? 'webhook' : 'oauth';
    sheetPatch({
      enabled: true,
      mode: nextMode,
      status: nextMode === 'oauth'
        ? (draftIntegrations.sheets.connectedEmail && draftIntegrations.sheets.spreadsheetId ? 'connected' : 'disconnected')
        : (draftIntegrations.sheets.webhookUrl || draftIntegrations.sheets.url ? draftIntegrations.sheets.status || 'connected' : 'disconnected'),
      lastError: '',
    });
  };

  const refreshGoogleSheetsOAuthStatus = useCallback(async ({ quiet = false } = {}) => {
    const project = googleSheetsProject();
    if (!project.projectId) {
      if (!quiet) setResult('페이지를 먼저 저장한 뒤 Google Sheets 상태를 확인해주세요.');
      return;
    }
    setTesting('sheets-status');
    if (!quiet) setResult('');
    try {
      const query = new URLSearchParams({ projectId: project.projectId, slug: project.slug || '' });
      const response = await apiFetch(`/api/integrations/google/sheets/status?${query.toString()}`, {
        headers: projectAuthHeaders(project),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `상태 확인 실패: ${response.status}`);
      const nextIntegrations = sheetPatch({
        enabled: true,
        mode: 'oauth',
        status: data.connected ? 'connected' : 'disconnected',
        connectedEmail: data.connectedEmail || '',
        spreadsheetId: data.spreadsheetId || '',
        spreadsheetUrl: data.spreadsheetUrl || '',
        sheetName: data.sheetName || draftIntegrations.sheets.sheetName || '접수함',
        lastError: data.hasError ? (draftIntegrations.sheets.lastError || 'Google Sheets 연결 확인이 필요합니다.') : '',
      });
      if (data.connected) {
        try {
          await onSavePage?.({ ...page, integrations: nextIntegrations });
          setDraftDirty(false);
        } catch {
          setDraftDirty(true);
        }
      }
      if (!quiet || data.connected) setResult(data.connected ? 'Google Sheets 연결 완료' : 'Google 연결이 아직 완료되지 않았습니다.');
    } catch (error) {
      if (!quiet) setResult(`Google 상태 확인 실패: ${String(error?.message || error)}`);
    } finally {
      setTesting('');
    }
  }, [page, authUser?.email, draftIntegrations, onSavePage]);

  useEffect(() => {
    const onGoogleSheetsConnected = (event) => {
      const data = event?.data || {};
      if (data?.type !== 'pagero:google-sheets-connected') return;
      const project = googleSheetsProject();
      if (data.projectId && project.projectId && data.projectId !== project.projectId) return;
      refreshGoogleSheetsOAuthStatus({ quiet: false });
    };
    window.addEventListener('message', onGoogleSheetsConnected);
    return () => window.removeEventListener('message', onGoogleSheetsConnected);
  }, [refreshGoogleSheetsOAuthStatus, page.slug, authUser?.email]);

  const connectGoogleSheetsOAuth = async () => {
    const project = googleSheetsProject();
    if (!project.projectId) {
      setResult('페이지를 먼저 저장한 뒤 Google Sheets를 연결해주세요.');
      return;
    }
    setTesting('sheets-oauth');
    setResult('');
    try {
      const response = await postJson('/api/integrations/google/sheets/oauth-url', {
        projectId: project.projectId,
        ownerId: project.ownerId,
        slug: project.slug,
        project,
        sheetHeaders: googleSheetsHeaders(),
      }, {
        headers: projectAuthHeaders(project),
      });
      if (!response?.authUrl) throw new Error(response?.message || 'Google 연결 URL을 만들지 못했습니다.');
      sheetPatch({ enabled: true, mode: 'oauth', status: 'disconnected', lastError: '' });
      const popup = window.open(response.authUrl, '_blank', 'noopener,noreferrer');
      setResult('Google 연결 창을 열었습니다. 완료되면 자동으로 상태를 확인합니다.');
      if (popup) {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
          if (!popup.closed && Date.now() - startedAt < 120000) return;
          window.clearInterval(timer);
          refreshGoogleSheetsOAuthStatus({ quiet: true });
        }, 900);
      }
    } catch (error) {
      setResult(`Google 연결 실패: ${String(error?.message || error)}`);
    } finally {
      setTesting('');
    }
  };

  const disconnectGoogleSheetsOAuth = async () => {
    const project = googleSheetsProject();
    setTesting('sheets-disconnect');
    setResult('');
    try {
      if (project.projectId) {
        await postJson('/api/integrations/google/sheets/disconnect', {
          projectId: project.projectId,
          ownerId: project.ownerId,
          slug: project.slug,
          project,
        }, {
          headers: projectAuthHeaders(project),
        });
      }
      const nextIntegrations = sheetPatch({
        enabled: false,
        mode: 'oauth',
        status: 'disconnected',
        connectedEmail: '',
        spreadsheetId: '',
        spreadsheetUrl: '',
        lastError: '',
      });
      try {
        await onSavePage?.({ ...page, integrations: nextIntegrations });
        setDraftDirty(false);
      } catch {
        setDraftDirty(true);
      }
      setResult('Google Sheets 연결 해제 완료');
    } catch (error) {
      setResult(`Google 연결 해제 실패: ${String(error?.message || error)}`);
    } finally {
      setTesting('');
    }
  };

  const saveSheetsDraft = async () => {
    const currentSheets = draftIntegrations.sheets || {};
    const currentUrl = currentSheets.webhookUrl || currentSheets.url || '';
    const hasWebhook = !!String(currentUrl || '').trim();
    const nextIntegrations = draftPatch('sheets', {
      ...currentSheets,
      enabled: hasWebhook || !!currentSheets.enabled,
      webhookUrl: currentUrl,
      url: currentUrl,
      sheetName: currentSheets.sheetName || '접수함',
      status: hasWebhook ? (currentSheets.status === 'error' ? 'connected' : currentSheets.status || 'connected') : 'disconnected',
      lastError: '',
    });
    updateIntegrations?.('sheets', nextIntegrations.sheets);
    setSaving(true);
    setResult('');
    try {
      await onSavePage?.({ ...page, integrations: nextIntegrations });
      setDraftDirty(false);
      setResult('Google Sheets 설정 저장 완료');
    } catch (error) {
      setResult(`Google Sheets 저장 실패: ${String(error?.message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  const copySheetsScript = async () => {
    setResult('');
    try {
      await navigator.clipboard.writeText(GOOGLE_SHEETS_APPS_SCRIPT);
      setCopiedScript(true);
      setResult('Google Sheets 샘플 코드 복사 완료');
      window.setTimeout(() => setCopiedScript(false), 1800);
    } catch {
      setResult('복사 실패');
    }
  };

  const testSheets = async () => {
    setTesting('sheets');
    setResult('');
    const currentSheets = draftIntegrations.sheets || {};
    const currentUrl = currentSheets.webhookUrl || currentSheets.url || '';
    const currentSheetName = currentSheets.sheetName || '접수함';
    sheetPatch({ webhookUrl: currentUrl, url: currentUrl, sheetName: currentSheetName, enabled: true, lastError: '' });
    try {
      const testIntegrations = normalizeIntegrations({
        ...draftIntegrations,
        sheets: {
          ...currentSheets,
          enabled: true,
          webhookUrl: currentUrl,
          url: currentUrl,
          sheetName: currentSheetName,
        },
      });
      const response = await runConnectionTest('sheets', { ...page, integrations: testIntegrations });
      const ok = !!response?.ok;
      sheetPatch({
        webhookUrl: currentUrl,
        url: currentUrl,
        sheetName: currentSheetName,
        enabled: true,
        status: ok ? 'connected' : 'error',
        lastSyncAt: ok ? new Date().toISOString() : currentSheets.lastSyncAt,
        lastError: ok ? '' : (response?.message || 'Google Sheets 연결 테스트 실패'),
      });
      setResult(response?.message || (ok ? 'Google Sheets 테스트 완료' : 'Google Sheets 테스트 실패'));
    } catch (error) {
      const message = `Google Sheets 테스트 실패: ${String(error?.message || error || '접수 저장이 지연됩니다.')}`;
      sheetPatch({ webhookUrl: currentUrl, url: currentUrl, sheetName: currentSheetName, enabled: true, status: 'error', lastError: message });
      setResult(message);
    } finally {
      setTesting('');
    }
  };

  const save = async () => {
    setSaving(true);
    setResult('');
    const nextIntegrations = enforceFreeEmailIntegration(draftIntegrations, page, authUser);
    try {
      Object.entries(nextIntegrations).forEach(([section, value]) => {
        updateIntegrations?.(section, value);
      });
      await onSavePage?.({ ...page, integrations: nextIntegrations });
      setDraftIntegrations(nextIntegrations);
      setDraftDirty(false);
      setResult('저장 완료');
    } catch (error) {
      setResult(`저장 실패: ${String(error?.message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`card inbox-connect-card easy-mode v4 ${open ? 'open' : ''}`}>
      <button className="inbox-connect-head" type="button" onClick={() => setOpen(!open)}>
        <div><h2>연동</h2></div>
        <div className="connect-head-right">
          <span>{counts.ok}개 연결</span>
          {counts.warn > 0 && <i>{counts.warn}개 확인 필요</i>}
          <b>{open ? '접기' : '열기'}</b>
        </div>
      </button>
      {open && (
        <div className="inbox-connect-body compact">
          {result && <div className={`connection-result ${resultIsOk(result) ? 'ok' : 'error'}`}><span>{result}</span></div>}

          <div className="connection-item connect-v4 open">
            <div className="connection-row">
              <div className="connection-row-main"><strong>이메일 알림</strong><small>{emailState.text}</small></div>
              <InlineSwitch checked={!!draftIntegrations.email.enabled} onChange={(enabled) => patch('email', { enabled, ...(emailLocked ? { to: accountEmail, lockedToAccount: true } : {}) })} />
            </div>
            {draftIntegrations.email.enabled && (
              <div className="connection-detail-box compact">
                <label className="connection-inline-control email-recipient-control">
                  <span>받을 이메일</span>
                  {emailLocked ? (
                    <strong className="locked-email-value" aria-label="계정 이메일로 고정됨">{accountEmail || '계정 이메일 없음'}</strong>
                  ) : (
                    <input value={draftIntegrations.email.to || ''} placeholder="example@email.com" onChange={(event) => patch('email', { to: event.target.value })} />
                  )}
                </label>
                {emailLocked && <p className="connection-help-text">무료 사용자는 계정 이메일로만 알림을 받습니다.</p>}
                <div className="connection-inline-control">
                  <span>알림 대상</span>
                  <div className="inline-chip-row">
                    <MiniToggle active={draftIntegrations.email.consult !== false} onClick={() => patch('email', { consult: !(draftIntegrations.email.consult !== false) })}>상담</MiniToggle>
                    <MiniToggle active={draftIntegrations.email.reservation !== false} onClick={() => patch('email', { reservation: !(draftIntegrations.email.reservation !== false) })}>예약</MiniToggle>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="connection-item connect-v4 open">
            <div className="connection-row">
              <div className="connection-row-main"><strong>Google Sheets</strong><small>{sheetsState.text} · 입력폼 자동 컬럼</small></div>
              <InlineSwitch checked={!!draftIntegrations.sheets.enabled} onChange={(enabled) => sheetPatch({ enabled, status: enabled ? draftIntegrations.sheets.status || 'disconnected' : 'disconnected', lastError: enabled ? '' : draftIntegrations.sheets.lastError })} />
            </div>
            {draftIntegrations.sheets.enabled && (
              <div className="connection-detail-box compact">
                <div className="connection-inline-control">
                  <span>연결 방식</span>
                  <div className="inline-chip-row">
                    <MiniToggle active={(draftIntegrations.sheets.mode || 'oauth') === 'oauth'} onClick={() => switchSheetsMode('oauth')}>Google 연결</MiniToggle>
                    <MiniToggle active={draftIntegrations.sheets.mode === 'webhook'} onClick={() => switchSheetsMode('webhook')}>직접 URL</MiniToggle>
                  </div>
                </div>
                {(draftIntegrations.sheets.mode || 'oauth') === 'oauth' ? (
                  <>
                    <div className="connection-inline-control">
                      <span>연결 계정</span>
                      <strong className="locked-email-value">{draftIntegrations.sheets.connectedEmail || '연결 필요'}</strong>
                    </div>
                    <p className="connection-help-text">연결하면 현재 입력폼 항목대로 시트 컬럼을 생성합니다.</p>
                    <div className="connection-inline-actions">
                      {draftIntegrations.sheets.spreadsheetUrl && (
                        <a className="test-connection-btn sheet-open-btn" href={draftIntegrations.sheets.spreadsheetUrl} target="_blank" rel="noreferrer">시트 열기</a>
                      )}
                      <button type="button" className="save-connection-btn" disabled={testing === 'sheets-oauth'} onClick={connectGoogleSheetsOAuth}>{testing === 'sheets-oauth' ? '연결 중' : 'Google로 연결'}</button>
                      <button type="button" className="test-connection-btn" disabled={testing === 'sheets-status'} onClick={refreshGoogleSheetsOAuthStatus}>{testing === 'sheets-status' ? '확인 중' : '상태 확인'}</button>
                      <button type="button" className="test-connection-btn" disabled={testing === 'sheets-disconnect'} onClick={disconnectGoogleSheetsOAuth}>{testing === 'sheets-disconnect' ? '해제 중' : '연결 해제'}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="connection-inline-control">
                      <span>Webhook URL</span>
                      <input value={draftIntegrations.sheets.webhookUrl || draftIntegrations.sheets.url || ''} placeholder="Google Apps Script Web App URL" onChange={(event) => sheetPatch({ webhookUrl: event.target.value, url: event.target.value, status: 'disconnected', lastError: '' })} />
                    </label>
                    <label className="connection-inline-control">
                      <span>시트명</span>
                      <input value={draftIntegrations.sheets.sheetName || ''} placeholder="접수함" onChange={(event) => sheetPatch({ sheetName: event.target.value })} />
                    </label>
                    <p className="connection-help-text">전송 실패 시에도 접수 데이터는 페이지로 접수함에 먼저 보관됩니다.</p>
                    <div className="connection-inline-actions">
                      <button type="button" className="test-connection-btn" onClick={copySheetsScript}>{copiedScript ? '복사됨' : '샘플 코드 복사'}</button>
                      <button type="button" className="test-connection-btn" disabled={testing === 'sheets'} onClick={testSheets}>{testing === 'sheets' ? '테스트 중' : '연결 테스트'}</button>
                      <button type="button" className="save-connection-btn" disabled={saving} onClick={saveSheetsDraft}>연동 저장</button>
                      <button type="button" className="test-connection-btn" onClick={() => patch('sheets', { enabled: false, status: 'disconnected', webhookUrl: '', url: '', lastError: '' })}>연결 해제</button>
                    </div>
                  </>
                )}
                {draftIntegrations.sheets.lastError && <div className="connection-result error"><span>{draftIntegrations.sheets.lastError}</span></div>}
              </div>
            )}
          </div>

          <button type="button" className="connection-advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
            <span>고급 연동</span>
            <b>{draftIntegrations.webhook.enabled ? webhookState.text : '선택 사항'}</b>
          </button>
          {advancedOpen && (
            <div className="connection-item connect-v4 open advanced">
              <div className="connection-row">
                <div className="connection-row-main"><strong>Webhook</strong><small>{webhookState.text}</small></div>
                <InlineSwitch checked={!!draftIntegrations.webhook.enabled} onChange={(enabled) => patch('webhook', { enabled })} />
              </div>
              {draftIntegrations.webhook.enabled && (
                <div className="connection-detail-box compact">
                  <label className="connection-inline-control">
                    <span>전송 URL</span>
                    <input value={draftIntegrations.webhook.url || ''} placeholder="https://..." onChange={(event) => patch('webhook', { url: event.target.value })} />
                  </label>
                </div>
              )}
            </div>
          )}
          <button type="button" className="save-connection-btn" disabled={saving} onClick={save}>{saving ? '저장 중' : '연동 전체 저장'}</button>
        </div>
      )}
    </section>
  );
}
