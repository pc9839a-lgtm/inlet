import React, { Suspense } from 'react';
import PanelHeader from '../../builder/PanelHeader.jsx';
import { LazyChunkBoundary, LazyPanelFallback } from '../../runtime/LazyRuntimeBoundary.jsx';
import { TemplatesPanel } from '../../runtime/lazySurfaces.jsx';
import { ClientAdminHeader } from './ClientAdminHeader.jsx';
import { WorkspaceActivePanel } from './WorkspaceActivePanel.jsx';
import { WorkspaceTabs } from './WorkspaceTabs.jsx';

export function WorkspaceLeftPanel({
  canUseBuilder,
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
  const showTemplateIntro = canManageAdmin && startMode === 'template';

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
            {clientAdminMode ? (
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
                previewUrl={previewUrl}
              />
            )}

            <WorkspaceTabs allowedTabs={allowedTabs} tab={tab} changeTab={changeTab} />

            <WorkspaceActivePanel
              canUseBuilder={canUseBuilder}
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