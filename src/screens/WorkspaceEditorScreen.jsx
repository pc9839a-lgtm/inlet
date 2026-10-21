import React from 'react';
import { WorkspaceLeftPanel } from './workspace/WorkspaceLeftPanel.jsx';
import { WorkspacePreviewPane } from './workspace/WorkspacePreviewPane.jsx';
import '../styles/product-ui-tokens.css';
import '../styles/workspace-shell.css';
import './workspace/OperationsWorkspace.css';
import '../styles/editor-workspace.css';
import '../styles/settings-workspace.css';

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
  const [inspectorHost, setInspectorHost] = React.useState(null);
  const [blockListOpen, setBlockListOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [previewSelectionRequest, setPreviewSelectionRequest] = React.useState(0);
  const effectiveTab = tab === 'style' ? 'edit' : tab;
  const inboxWorkspace = !mobileOperationsOnly && effectiveTab === 'inbox';
  const statsWorkspace = !mobileOperationsOnly && effectiveTab === 'stats';
  const settingsWorkspace = !mobileOperationsOnly && effectiveTab === 'settings';
  const editWorkspace = !mobileOperationsOnly && effectiveTab === 'edit';
  const operationsWorkspace = inboxWorkspace || statsWorkspace || settingsWorkspace;
  const previewWorkspace = !mobileOperationsOnly && !operationsWorkspace;

  const openInspector = React.useCallback(() => {
    setBlockListOpen(false);
    setSettingsOpen(true);
  }, []);

  // Keep the selected block accessible when a narrow editor collapses its panels.
  React.useEffect(() => {
    if (editWorkspace && selectedBlockId) openInspector();
  }, [editWorkspace, selectedBlockId, openInspector]);

  const handleSelectPreviewBlock = React.useCallback((id) => {
    if (!id) return;
    onSelectPreviewBlock?.(id);
    // An already-selected block may be clicked while page options are open.
    // Still switch the inspector back to block settings on every canvas click.
    setPreviewSelectionRequest((request) => request + 1);
    openInspector();
  }, [onSelectPreviewBlock, openInspector]);

  return (
    <div className={`builder-shell${previewWorkspace ? ' preview-workspace-shell' : ''}${canUseBuilder && startMode === 'template' && !mobileOperationsOnly ? ' template-intro-shell' : ''}${mobileOperationsOnly ? ' mobile-operations-shell' : ''}${editWorkspace ? ' edit-mode-shell' : ''}${inboxWorkspace ? ' inbox-workspace-shell' : ''}${statsWorkspace ? ' stats-dashboard-shell' : ''}${settingsWorkspace ? ' settings-workspace-shell' : ''}`} data-block-list-open={blockListOpen} data-settings-open={settingsOpen}>

      {editWorkspace && canUseBuilder && (
        <>
          <button type="button" className="editor-block-list-toggle" aria-controls="pagero-block-panel"
            aria-expanded={blockListOpen} onClick={() => setBlockListOpen((open) => !open)}>블록</button>
          <button type="button" className="editor-settings-toggle" aria-controls="pagero-settings-panel"
            aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>설정</button>
        </>
      )}

      <WorkspaceLeftPanel
        canUseBuilder={canUseBuilder}
        mobileOperationsOnly={mobileOperationsOnly}
        canManageAdmin={canManageAdmin}
        clientAdminMode={clientAdminMode}
        startMode={startMode}
        page={page}
        tab={effectiveTab}
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
        inspectorHost={inspectorHost}
        onActivateInspector={openInspector}
        previewSelectionRequest={previewSelectionRequest}
        stylePanelProps={stylePanelProps}
        inboxPanelProps={inboxPanelProps}
        statsPanelProps={statsPanelProps}
        settingsPanelProps={settingsPanelProps}
      />

      {previewWorkspace && <WorkspacePreviewPane
        previewPage={previewPage}
        leads={leads}
        addLead={addLead}
        track={track}
        selectedBlockId={selectedBlockId}
        onSelectPreviewBlock={handleSelectPreviewBlock}
      />}
      {editWorkspace && canUseBuilder && (
        <aside id="pagero-settings-panel" className="editor-inspector-host"
          ref={setInspectorHost} role="region" tabIndex={0} aria-label="선택한 블록 상세 설정" />
      )}
    </div>
  );
}
