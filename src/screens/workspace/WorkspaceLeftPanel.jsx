import React, { Suspense, useLayoutEffect, useRef } from 'react';
import { createPortablePageBackup, pageDraftContentSignature, pageDraftIdentity, pageDraftStorageFailureMessage, restorePageDraft, savePageDraftResult, validatePortablePageBackup } from '../../runtime/pageDraftStore.js';
import PanelHeader from '../../builder/PanelHeader.jsx';
import { LazyChunkBoundary, LazyPanelFallback } from '../../runtime/LazyRuntimeBoundary.jsx';
import { TemplatesPanel } from './workspaceLazySurfaces.jsx';
import { ClientAdminHeader } from './ClientAdminHeader.jsx';
import { MobileOperationsHeader } from './MobileOperationsHeader.jsx';
import { WorkspaceActivePanel } from './WorkspaceActivePanel.jsx';
import { WorkspaceTabs } from './WorkspaceTabs.jsx';
import './WorkspaceChrome.css';

export function WorkspaceLeftPanel({
  canUseBuilder,
  mobileOperationsOnly,
  canManageAdmin,
  clientAdminMode,
  startMode,
  page,
  tab,
  saved,
  saveStatus,
  onSave,
  onPreview,
  onDashboard,
  onStartChoice,
  previewUrl,
  templates,
  createFromTemplate,
  allowedTabs,
  changeTab,
  editPanelProps,
  stylePanelProps,
  inboxPanelProps,
  statsPanelProps,
  settingsPanelProps,
}) {
  const activePageRef = useRef(page);
  const activeUserRef = useRef(settingsPanelProps?.authUser || null);
  useLayoutEffect(() => {
    activePageRef.current = page;
    activeUserRef.current = settingsPanelProps?.authUser || null;
  }, [page, settingsPanelProps?.authUser]);

  const canBackup = canUseBuilder && !mobileOperationsOnly
    && !!settingsPanelProps?.authUser && typeof settingsPanelProps?.setPage === 'function';

  const backupToast = (message, tone = 'info') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('builder:toast', { detail: { message, tone } }));
    }
  };

  const downloadPageBackup = () => {
    if (!canBackup || typeof document === 'undefined') return;
    let objectUrl = '';
    try {
      const backup = createPortablePageBackup({
        page: activePageRef.current,
        authUser: activeUserRef.current,
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const slug = String(activePageRef.current?.slug || 'page').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
      anchor.href = objectUrl;
      anchor.download = `pagero-${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      backupToast('편집본 파일을 내려받았습니다. 개인 정보가 포함될 수 있으니 안전하게 보관하세요.', 'success');
    } catch {
      backupToast('파일 백업을 만들지 못했습니다. 이 화면을 닫지 말고 다시 시도해주세요.', 'error');
    } finally {
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  };

  const importPageBackup = async (file) => {
    if (!canBackup || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      backupToast('백업 파일이 10MB를 초과합니다. 파일을 확인해주세요.', 'error');
      return;
    }
    const originalPage = activePageRef.current;
    const originalUser = activeUserRef.current;
    const originalIdentity = pageDraftIdentity(originalPage, originalUser);
    const originalSignature = pageDraftContentSignature(originalPage);
    try {
      const backup = JSON.parse(await file.text());
      const currentPage = activePageRef.current;
      const currentUser = activeUserRef.current;
      if (pageDraftIdentity(currentPage, currentUser) !== originalIdentity
        || currentUser?.session !== originalUser?.session
        || pageDraftContentSignature(currentPage) !== originalSignature) {
        backupToast('파일을 읽는 동안 페이지가 변경됐습니다. 다시 불러와 주세요.', 'warning');
        return;
      }
      const validated = validatePortablePageBackup({ backup, page: currentPage, authUser: currentUser });
      if (!validated.ok) {
        backupToast(validated.reason === 'page-mismatch'
          ? '다른 계정이나 페이지의 백업 파일은 불러올 수 없습니다.'
          : 'PageRo 편집본 백업 형식이 올바르지 않습니다.', 'error');
        return;
      }
      window.dispatchEvent(new CustomEvent('builder:confirm', {
        detail: {
          title: '편집본 파일 복원',
          message: `현재 편집 내용을 백업 파일로 교체합니다. ${validated.serverChanged ? '서버 저장 버전이 달라 충돌 여부를 확인해야 합니다. ' : ''}복원 후 직접 발행해야 공개 페이지에 반영됩니다. 계속할까요?`,
          confirmLabel: '파일 복원',
          cancelLabel: '취소',
          onConfirm: () => {
            const latest = activePageRef.current;
            const account = activeUserRef.current;
            if (pageDraftIdentity(latest, account) !== originalIdentity
              || account?.session !== originalUser?.session
              || pageDraftContentSignature(latest) !== originalSignature) {
              backupToast('그 사이 편집 내용이 변경되어 복원을 취소했습니다. 다시 선택해주세요.', 'warning');
              return;
            }
            const restored = restorePageDraft({ draft: validated.draft, serverPage: latest });
            const result = savePageDraftResult({ page: restored, authUser: account, interactionConfirmed: true });
            settingsPanelProps.setPage(restored);
            backupToast(result.ok
              ? '편집본을 복원했습니다. 내용을 확인한 뒤 발행해주세요.'
              : `편집본은 화면에 복원했지만 ${pageDraftStorageFailureMessage(result)} 파일을 보관하고 발행해주세요.`,
            result.ok ? 'success' : 'error');
          },
        },
      }));
    } catch {
      backupToast('파일을 읽지 못했습니다. 올바른 JSON 백업 파일인지 확인해주세요.', 'error');
    }
  };

  const showTemplateIntro = !mobileOperationsOnly && canManageAdmin && startMode === 'template';
  const header = mobileOperationsOnly ? (
    <MobileOperationsHeader page={page} />
  ) : clientAdminMode ? (
    <ClientAdminHeader page={page} onDashboard={onDashboard} onPreview={onPreview} previewUrl={previewUrl} />
  ) : (
    <PanelHeader
      page={page}
      tab={tab}
      saved={saved}
      saveStatus={saveStatus}
      onSave={onSave}
      onPreview={onPreview}
      onDashboard={onDashboard}
      onStartChoice={onStartChoice}
      previewUrl={previewUrl}
      backupEnabled={canBackup}
      onBackup={downloadPageBackup}
      onImportBackup={importPageBackup}
    />
  );

  return (
    <aside className="left-workspace">
      {!showTemplateIntro && <div className="workspace-persistent-header">{header}</div>}

      <section className="work-panel">
        {showTemplateIntro ? (
          <LazyChunkBoundary resetKey="templates">
            <Suspense fallback={<LazyPanelFallback />}>
              <TemplatesPanel page={page} templates={templates} onApply={createFromTemplate} />
            </Suspense>
          </LazyChunkBoundary>
        ) : (
          <>
            <WorkspaceTabs allowedTabs={allowedTabs} tab={tab} changeTab={changeTab} />

            <WorkspaceActivePanel
              canUseBuilder={canUseBuilder}
              mobileOperationsOnly={mobileOperationsOnly}
              tab={tab}
              editPanelProps={editPanelProps}
              stylePanelProps={stylePanelProps}
              inboxPanelProps={inboxPanelProps}
              statsPanelProps={statsPanelProps}
              settingsPanelProps={settingsPanelProps}
            />
          </>
        )}
      </section>
    </aside>
  );
}