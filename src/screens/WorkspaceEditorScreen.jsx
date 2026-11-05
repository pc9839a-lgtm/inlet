import React from 'react';
import { WorkspaceLeftPanel } from './workspace/WorkspaceLeftPanel.jsx';
import { WorkspacePreviewPane } from './workspace/WorkspacePreviewPane.jsx';
import { patchInlineTextBlock } from '../editor/previewInlineTextModel.js';
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
  const effectiveTab = tab === 'style' ? 'edit' : tab;
  const inboxWorkspace = !mobileOperationsOnly && effectiveTab === 'inbox';
  const statsWorkspace = !mobileOperationsOnly && effectiveTab === 'stats';
  const settingsWorkspace = !mobileOperationsOnly && effectiveTab === 'settings';
  const editWorkspace = !mobileOperationsOnly && effectiveTab === 'edit';
  const operationsWorkspace = inboxWorkspace || statsWorkspace || settingsWorkspace;
  const previewWorkspace = !mobileOperationsOnly && !operationsWorkspace;

  // Apply preview edits through the same functional draft setter as the Inspector.
  // A changed/deleted source block fails closed instead of overwriting newer data.
  const editPreviewText = (blockId, field, nextHtml, previousHtml) => {
    if (!canUseBuilder || !editWorkspace || startMode === 'template' || stylePanelProps?.hasPendingStyle
      || typeof settingsPanelProps?.setPage !== 'function') return false;
    const currentPage = editPanelProps?.page;
    if (!currentPage || patchInlineTextBlock(currentPage, { blockId, field, previousHtml, nextHtml }) === currentPage) return false;
    settingsPanelProps.setPage((latest) => patchInlineTextBlock(latest, { blockId, field, previousHtml, nextHtml }));
    return true;
  };

  // An image click keeps the existing preview selection and directs attention
  // to the current ImageInput uploader. Never opens a native picker implicitly,
  // bypasses the existing media library, or writes image content itself.
  const selectPreviewBlockWithImage = (id, interaction) => {
    onSelectPreviewBlock?.(id);
    if (!interaction?.imageClick || !canUseBuilder || !editWorkspace || startMode === 'template'
      || stylePanelProps?.hasPendingStyle || typeof requestAnimationFrame !== 'function') return;
    const selectedImage = editPanelProps?.page?.blocks?.find((block) => block.id === id && block.type === 'image');
    if (!selectedImage || selectedImage.visible === false) return;
    const focusUpload = (attempts) => {
      const settings = document.getElementById(`editor-block-settings-${id}`);
      const button = settings?.querySelector(
        '.image-input-upload-action:not([disabled]), .gallery-multi-upload button:not([disabled]), .image-input-library-action:not([disabled])'
      );
      if (!button && attempts > 0) {
        requestAnimationFrame(() => focusUpload(attempts - 1));
        return;
      }
      if (button) {
        button.scrollIntoView({ block: 'nearest' });
        button.focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(() => focusUpload(5));
  };

  return (
    <div className={`builder-shell${previewWorkspace ? ' preview-workspace-shell' : ''}${canUseBuilder && startMode === 'template' && !mobileOperationsOnly ? ' template-intro-shell' : ''}${mobileOperationsOnly ? ' mobile-operations-shell' : ''}${editWorkspace ? ` edit-mode-shell${startMode !== 'template' ? ' canvas-editor-shell' : ''}` : ''}${inboxWorkspace ? ' inbox-workspace-shell' : ''}${statsWorkspace ? ' stats-dashboard-shell' : ''}${settingsWorkspace ? ' settings-workspace-shell' : ''}`}>

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
        onSelectPreviewBlock={selectPreviewBlockWithImage}
        onEditPreviewText={canUseBuilder && editWorkspace && startMode !== 'template' && !stylePanelProps?.hasPendingStyle ? editPreviewText : undefined}
      />}
    </div>
  );
}
