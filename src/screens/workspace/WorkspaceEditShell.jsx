import React from 'react';
import PanelHeader from '../../builder/PanelHeader.jsx';
import EditPanel from '../../editor/EditPanel.jsx';
import { WorkspacePreviewPane } from './WorkspacePreviewPane.jsx';
import { WorkspaceTabs } from './WorkspaceTabs.jsx';

export function WorkspaceEditShell({
  page,
  tab,
  saved,
  saveStatus,
  onSave,
  onPreview,
  onDashboard,
  previewUrl,
  allowedTabs,
  changeTab,
  editPanelProps,
  stylePanelProps,
  settingsPanelProps,
  previewPage,
  leads,
  addLead,
  track,
  selectedBlockId,
  onSelectPreviewBlock,
}) {
  const previewPane = (
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
  );

  return (
    <div className="builder-shell edit-mode-shell">
      <div className="edit-workspace-header">
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
      </div>

      <div className="edit-workspace-global-nav">
        <WorkspaceTabs allowedTabs={allowedTabs} tab={tab} changeTab={changeTab} />
      </div>

      <EditPanel
        {...editPanelProps}
        stylePanelProps={stylePanelProps}
        authUser={settingsPanelProps?.authUser || null}
        previewPane={previewPane}
      />
    </div>
  );
}
