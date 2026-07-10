import React from 'react';
import { WorkspaceLeftPanel } from './workspace/WorkspaceLeftPanel.jsx';
import { WorkspacePreviewPane } from './workspace/WorkspacePreviewPane.jsx';

export default function WorkspaceEditorScreen({
  canUseBuilder,
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

  return (
    <div className={`builder-shell${canUseBuilder && startMode === 'template' ? ' template-intro-shell' : ''}`}>

      <WorkspaceLeftPanel
        canUseBuilder={canUseBuilder}
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

      <WorkspacePreviewPane
        page={page}
        previewUrl={previewUrl}
        previewPage={previewPage}
        leads={leads}
        addLead={addLead}
        track={track}
        selectedBlockId={selectedBlockId}
        onSelectPreviewBlock={onSelectPreviewBlock}
      />
    </div>
  );
}