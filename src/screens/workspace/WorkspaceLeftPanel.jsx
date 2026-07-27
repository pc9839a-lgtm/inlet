import React, { Suspense } from 'react';
import PanelHeader from '../../builder/PanelHeader.jsx';
import { LazyChunkBoundary, LazyPanelFallback } from '../../runtime/LazyRuntimeBoundary.jsx';
import { TemplatesPanel } from './workspaceLazySurfaces.jsx';
import { ClientAdminHeader } from './ClientAdminHeader.jsx';
import { MobileOperationsHeader } from './MobileOperationsHeader.jsx';
import { WorkspaceActivePanel } from './WorkspaceActivePanel.jsx';
import { WorkspaceTabs } from './WorkspaceTabs.jsx';

export function WorkspaceLeftPanel({
  canUseBuilder,
  mobileOperationsOnly,
  canManageAdmin,
  clientAdminMode,
  startMode,
  page,
  tab,
  saved,
  saving,
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
  const showTemplateIntro = !mobileOperationsOnly && canManageAdmin && startMode === 'template';

  return (
    <aside className="left-workspace">
      <section className="work-panel">
        {showTemplateIntro ? (
          <LazyChunkBoundary resetKey="templates">
            <Suspense fallback={<LazyPanelFallback />}>
              <TemplatesPanel page={page} templates={templates} onApply={createFromTemplate} />
            </Suspense>
          </LazyChunkBoundary>
        ) : (
          <>
            {mobileOperationsOnly ? (
              <MobileOperationsHeader page={page} />
            ) : clientAdminMode ? (
              <ClientAdminHeader
                page={page}
                saved={saved}
                saving={saving}
                saveStatus={saveStatus}
                onSave={onSave}
                onDashboard={onDashboard}
                onPreview={onPreview}
                previewUrl={previewUrl}
              />
            ) : (
              <PanelHeader
                page={page}
                tab={tab}
                saved={saved}
                saving={saving}
                saveStatus={saveStatus}
                onSave={onSave}
                onPreview={onPreview}
                onDashboard={onDashboard}
                onStartChoice={onStartChoice}
                previewUrl={previewUrl}
              />
            )}

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