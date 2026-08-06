import React from 'react';
import { WorkspaceLeftPanel } from './workspace/WorkspaceLeftPanel.jsx';
import { WorkspacePreviewPane } from './workspace/WorkspacePreviewPane.jsx';
import '../styles/editor-workspace-v2.css';
import '../styles/workspace-inbox-redesign.css';
import '../styles/workspace-inbox-fullwidth-fix.css';
import '../styles/operations-settings.css';
import '../styles/operations-settings-compact.css';
import '../styles/external-connections-uniform.css';
import '../styles/inbox-scroll-width-final.css';
import '../styles/inbox-sidebar-summary-hide.css';
import '../styles/stats-dashboard-safe.css';
import '../styles/stats-fullwidth-final.css';
import '../styles/stats-operations-final.css';
import '../styles/stats-height-match-inbox.css';
import '../styles/ops-header-stats-cleanup.css';
import '../styles/inbox-blue-accent-cleanup.css';
import '../styles/settings-operations-final.css';
import '../styles/settings-content-polish.css';
import '../styles/settings-premium-final.css';
import '../styles/settings-monochrome-alignment-final.css';
import '../styles/operations-workspaces-unified.css';
import '../styles/operations-overflow-final.css';
import '../styles/settings-layout-containment-final.css';
import '../styles/stats-period-top-final.css';
import '../styles/seo-period-visual-final.css';
import '../styles/seo-image-actions-final.css';
import '../styles/operations-clipping-cleanup-final.css';
import '../styles/stats-regression-repair-final.css';
import '../styles/settings-seo-domain-polish-final.css';

export default function WorkspaceEditorScreen({
  canUseBuilder,
  mobileOperationsOnly,
  canManageAdmin,
  clientAdminMode,
  startMode,
  createOpen,
  onCloseCreate,
  page,
  tab,
  saved,
  saveStatus,
  onSave,
  onPreview,
  onDashboard,
  onStartChoice,
  previewUrl,
  createWithAi,
  createManual,
  createFromTemplate,
  onCheckUrl,
  defaultSlug,
  templates,
  allowedTabs,
  changeTab,
  editPanelProps,
  stylePanelProps,
  inboxPanelProps,
  statsPanelProps,
  settingsPanelProps,
  previewPage,
  leads,
  addLead,
  track,
  selectedBlockId,
  onSelectPreviewBlock,
}) {
  const inboxWorkspace = !mobileOperationsOnly && tab === 'inbox';
  const statsWorkspace = !mobileOperationsOnly && tab === 'stats';
  const settingsWorkspace = !mobileOperationsOnly && tab === 'settings';

  return (
    <div className={`builder-shell${canUseBuilder && startMode === 'template' && !mobileOperationsOnly ? ' template-intro-shell' : ''}${mobileOperationsOnly ? ' mobile-operations-shell' : ''}${inboxWorkspace ? ' inbox-workspace-shell' : ''}${statsWorkspace ? ' stats-dashboard-shell' : ''}${settingsWorkspace ? ' settings-workspace-shell' : ''}`}>

      <WorkspaceLeftPanel
        canUseBuilder={canUseBuilder}
        mobileOperationsOnly={mobileOperationsOnly}
        canManageAdmin={canManageAdmin}
        clientAdminMode={clientAdminMode}
        startMode={startMode}
        page={page}
        tab={tab}
        saved={saved}
        saveStatus={saveStatus}
        onSave={onSave}
        onPreview={onPreview}
        onDashboard={onDashboard}
        onStartChoice={onStartChoice}
        previewUrl={previewUrl}
        templates={templates}
        createFromTemplate={createFromTemplate}
        allowedTabs={allowedTabs}
        changeTab={changeTab}
        editPanelProps={editPanelProps}
        stylePanelProps={stylePanelProps}
        inboxPanelProps={inboxPanelProps}
        statsPanelProps={statsPanelProps}
        settingsPanelProps={settingsPanelProps}
      />

      {!mobileOperationsOnly && !inboxWorkspace && !settingsWorkspace && <WorkspacePreviewPane
        page={page}
        previewUrl={previewUrl}
        previewPage={previewPage}
        leads={leads}
        addLead={addLead}
        track={track}
        selectedBlockId={selectedBlockId}
        onSelectPreviewBlock={onSelectPreviewBlock}
      />}
    </div>
  );
}
