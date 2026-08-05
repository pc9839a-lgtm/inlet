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
import '../styles/inbox-sidebar-summary-pin.css';

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

  return (
    <div className={`builder-shell${canUseBuilder && startMode === 'template' && !mobileOperationsOnly ? ' template-intro-shell' : ''}${mobileOperationsOnly ? ' mobile-operations-shell' : ''}${inboxWorkspace ? ' inbox-workspace-shell' : ''}`}>

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

      {!mobileOperationsOnly && !inboxWorkspace && <WorkspacePreviewPane
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
