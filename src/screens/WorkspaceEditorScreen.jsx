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
    // ImageEditor is lazy-loaded; five animation frames can expire before
    // its uploader appears. Observe only the selected inspector and stop on
    // success or after a bounded timeout, without opening file dialogs.
    const inspector = document.querySelector('.editor-inspector-panel');
    if (!inspector || typeof MutationObserver !== 'function') return;
    let finished = false;
    let timeoutId = 0;
    const observer = new MutationObserver(() => focusUpload());
    const cleanup = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
    };
    const focusUpload = () => {
      if (finished) return;
      const settings = document.getElementById(`editor-block-settings-${id}`);
      const button = settings?.querySelector(
        '.image-input-upload-action:not([disabled]), .gallery-multi-upload button:not([disabled]), .image-input-library-action:not([disabled])'
      );
      if (!button) return;
      cleanup();
      button.scrollIntoView({ block: 'nearest' });
      button.focus({ preventScroll: true });
    };
    observer.observe(inspector, { childList: true, subtree: true });
    timeoutId = window.setTimeout(cleanup, 5000);
    requestAnimationFrame(focusUpload);
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
