import React from 'react';
import { WorkspaceLeftPanel } from './workspace/WorkspaceLeftPanel.jsx';
import { WorkspacePreviewPane } from './workspace/WorkspacePreviewPane.jsx';
import { patchInlineTextBlock } from '../editor/previewInlineTextModel.js';
import { canDuplicateScreenOrderBlock } from '../editor/editPanelParts/screenOrderActionPolicy.js';
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

  // A click on the rendered form title or description takes the user to
  // the exact existing content field, including when the Inspector is lazy.
  // No alternate form state or preview mutation is introduced.
  const pendingFormFocusRef = React.useRef(null);
  React.useEffect(() => () => pendingFormFocusRef.current?.(), []);
  const focusPreviewFormField = (id, field) => {
    if (!canUseBuilder || !editWorkspace || startMode === 'template' || stylePanelProps?.hasPendingStyle
      || !['title', 'description', 'submit'].includes(field)) return;
    const form = editPanelProps?.page?.blocks?.find((block) => block.id === id && block.type === 'form');
    if (!form || form.visible === false || typeof document === 'undefined'
      || typeof MutationObserver !== 'function') return;
    const inspector = document.querySelector('.editor-properties-content');
    if (!inspector) return;
    pendingFormFocusRef.current?.();
    let finished = false;
    let timeoutId = 0;
    const observer = new MutationObserver(tryFocus);
    const cleanup = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      if (pendingFormFocusRef.current === cleanup) pendingFormFocusRef.current = null;
    };
    function tryFocus() {
      if (finished) return;
      const settings = document.getElementById(`editor-block-settings-${id}`);
      if (!settings) return;
      const selector = field === 'title'
        ? '.form-basic-grid .field-title input'
        : field === 'submit'
          ? '.form-editor-flow > .field-title input'
          : '.form-basic-grid .editor-field-v2 textarea';
      const input = settings.querySelector(selector);
      if (!input || input.disabled) return;
      cleanup();
      input.scrollIntoView({ block: 'nearest' });
      input.focus({ preventScroll: true });
    }
    observer.observe(inspector, { childList: true, subtree: true });
    timeoutId = window.setTimeout(cleanup, 5000);
    requestAnimationFrame(tryFocus);
    pendingFormFocusRef.current = cleanup;
  };

  // An image click keeps the existing preview selection and directs attention
  // to the current ImageInput uploader. Never opens a native picker implicitly,
  // bypasses the existing media library, or writes image content itself.
  const selectPreviewBlockWithImage = (id, interaction) => {
    onSelectPreviewBlock?.(id);
    if (interaction?.focusField) focusPreviewFormField(id, interaction.focusField);
    if (!interaction?.imageClick || !canUseBuilder || !editWorkspace || startMode === 'template'
      || stylePanelProps?.hasPendingStyle || typeof requestAnimationFrame !== 'function') return;
    const selectedImage = editPanelProps?.page?.blocks?.find((block) => block.id === id && block.type === 'image');
    if (!selectedImage || selectedImage.visible === false) return;
    const galleryIndex = Number.isInteger(interaction.galleryIndex) && selectedImage.s?.mode === 'gallery'
      && selectedImage.s?.gallery?.[interaction.galleryIndex] ? interaction.galleryIndex : undefined;
    // ImageEditor is lazy-loaded; five animation frames can expire before
    // its uploader appears. Observe the persistent block stack: inline settings\n    // mount only after selection, so observe the persistent settings panel.\n    // Stop on
    // success or after a bounded timeout, without opening file dialogs.
    const inspector = document.querySelector('.editor-properties-content');
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
      if (!settings) return;
      let button;
      if (galleryIndex !== undefined) {
        // ImageGalleryEditor rows retain the *raw* slot index, even with blanks.
        // Do not fall back to GalleryMultiUpload: that would append, not replace.
        const row = settings.querySelectorAll('.image-editor-flow .editor-list-v2-items > .editor-list-item-v2')[galleryIndex];
        const trigger = row?.querySelector('.editor-list-item-v2-trigger');
        if (!trigger) return;
        if (trigger.getAttribute('aria-expanded') !== 'true') {
          trigger.click();
          return;
        }
        button = row.querySelector('[data-editor-gallery-item-index] .image-input-upload-action:not([disabled])');
      } else {
        button = settings.querySelector(
          '.image-input-upload-action:not([disabled]), .gallery-multi-upload button:not([disabled]), .image-input-library-action:not([disabled])'
        );
      }
      if (!button) return;
      cleanup();
      button.scrollIntoView({ block: 'nearest' });
      button.focus({ preventScroll: true });
    };
    observer.observe(inspector, { childList: true, subtree: true });
    timeoutId = window.setTimeout(cleanup, 5000);
    requestAnimationFrame(focusUpload);
  };

  // A second, explicit click on the selected photo invokes the *existing*
  // ImageInput picker synchronously inside the user's activation. First-click
  // selection only focuses settings; no unsolicited file dialog is opened.
  const replacePreviewImage = (id, galleryIndex) => {
    if (!canUseBuilder || !editWorkspace || startMode === 'template' || stylePanelProps?.hasPendingStyle
      || selectedBlockId !== id) return false;
    const block = editPanelProps?.page?.blocks?.find((entry) => entry.id === id);
    if (!block || block.type !== 'image' || block.visible === false) return false;
    const gallery = block.s?.mode === 'gallery';
    if (gallery && (!Number.isInteger(galleryIndex) || !block.s?.gallery?.[galleryIndex])) return false;
    const settings = document.getElementById(`editor-block-settings-${id}`);
    const row = gallery
      ? settings?.querySelectorAll('.image-editor-flow .editor-list-v2-items > .editor-list-item-v2')?.[galleryIndex]
      : null;
    const button = gallery
      ? row?.querySelector('[data-editor-gallery-item-index] .image-input-upload-action:not([disabled])')
      : settings?.querySelector('.image-input-upload-action:not([disabled])');
    if (!button) {
      // A collapsed/lazy gallery row needs one safe click to reveal its
      // existing ImageInput. A later explicit user click opens the file picker.
      selectPreviewBlockWithImage(id, { imageClick: true, galleryIndex });
      return false;
    }
    button.click();
    return true;
  };

  // Link cards, rows, and carousel items select their *own* link field.
  // Legacy links without stable IDs use their source-array position; no
  // click from the editor may navigate, dial, or send conversion analytics.
  const pendingLinkFocusRef = React.useRef(null);
  React.useEffect(() => () => pendingLinkFocusRef.current?.(), []);
  const editPreviewLinkItem = (id, index) => {
    if (!canUseBuilder || !editWorkspace || startMode === 'template' || stylePanelProps?.hasPendingStyle
      || !Number.isInteger(index) || index < 0) return;
    const block = editPanelProps?.page?.blocks?.find((entry) => entry.id === id && entry.type === 'links');
    if (!block || block.visible === false || !Array.isArray(block.s?.items) || !block.s.items[index]) return;
    pendingLinkFocusRef.current?.();
    onSelectPreviewBlock?.(id);
    const inspector = document.querySelector('.editor-properties-content');
    if (!inspector || typeof MutationObserver !== 'function') return;
    let finished = false;
    let timeoutId = 0;
    const observer = new MutationObserver(() => focusLink());
    const cleanup = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      if (pendingLinkFocusRef.current === cleanup) pendingLinkFocusRef.current = null;
    };
    const focusLink = () => {
      if (finished) return;
      const settings = document.getElementById(`editor-block-settings-${id}`);
      if (!settings) return;
      const tab = [...settings.querySelectorAll('.links-editor-v3 [role="tab"]')]
        .find((button) => button.textContent.trim() === '링크 목록');
      if (!tab) return;
      if (tab.getAttribute('aria-selected') !== 'true') {
        tab.click();
        return;
      }
      const row = settings.querySelectorAll('.links-editor-v3 .editor-list-v2-items > .editor-list-item-v2')[index];
      const trigger = row?.querySelector('.editor-list-item-v2-trigger');
      if (!trigger) return;
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        trigger.click();
        return;
      }
      const input = settings.querySelector(`input[data-link-item-label-index="${index}"]`);
      if (!input) return;
      cleanup();
      input.scrollIntoView({ block: 'nearest' });
      input.focus({ preventScroll: true });
    };
    observer.observe(inspector, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-expanded'] });
    timeoutId = window.setTimeout(cleanup, 5000);
    requestAnimationFrame(focusLink);
    pendingLinkFocusRef.current = cleanup;
  };

  // Bottom CTA clicks in an editor must edit the matching button, not follow
  // its URL, dial a phone, scroll to a section, or emit conversion analytics.
  const pendingBottomFocusRef = React.useRef(null);
  React.useEffect(() => () => pendingBottomFocusRef.current?.(), []);
  const editPreviewBottomButton = (id, index) => {
    if (!canUseBuilder || !editWorkspace || startMode === 'template' || stylePanelProps?.hasPendingStyle
      || !Number.isInteger(index) || index < 0 || index > 2) return;
    const bottom = editPanelProps?.page?.blocks?.find((entry) => entry.id === id && entry.type === 'bottombar');
    if (!bottom || bottom.visible === false || bottom.s?.buttons?.[index]?.enabled === false) return;
    pendingBottomFocusRef.current?.();
    onSelectPreviewBlock?.(id);
    const inspector = document.querySelector('.editor-properties-content');
    if (!inspector || typeof MutationObserver !== 'function') return;
    let finished = false;
    let timeoutId = 0;
    const observer = new MutationObserver(() => focusTarget());
    const cleanup = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      if (pendingBottomFocusRef.current === cleanup) pendingBottomFocusRef.current = null;
    };
    const focusTarget = () => {
      if (finished) return;
      const settings = document.getElementById(`editor-block-settings-${id}`);
      const trigger = settings?.querySelectorAll('.bottom-bar-editor-buttons .editor-list-item-v2-trigger')?.[index];
      if (!trigger) return;
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        trigger.click();
        return;
      }
      const input = settings.querySelector(`input[data-bottom-button-label-index="${index}"]`);
      if (!input) return;
      cleanup();
      input.scrollIntoView({ block: 'nearest' });
      input.focus({ preventScroll: true });
    };
    observer.observe(inspector, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
    timeoutId = window.setTimeout(cleanup, 5000);
    requestAnimationFrame(focusTarget);
  };

  // Canvas quick actions reuse the same ID-based editor handlers and guards.
  // The workbench never changes published data or calls live endpoints itself.
  const canEditCanvas = canUseBuilder && editWorkspace && startMode !== 'template'
    && !stylePanelProps?.hasPendingStyle && typeof editPanelProps?.setAddOpen === 'function';
  const canvasNormalBlocks = Array.isArray(editPanelProps?.page?.blocks)
    ? editPanelProps.page.blocks.filter((block) => !['topnav', 'bottombar', 'footer'].includes(block.type))
    : [];
  const canvasSelectedIndex = canvasNormalBlocks.findIndex((block) => block.id === selectedBlockId);
  const canvasSelectedBlock = canEditCanvas && canvasSelectedIndex >= 0
    && canvasNormalBlocks[canvasSelectedIndex].visible !== false
    ? canvasNormalBlocks[canvasSelectedIndex] : null;
  const canvasActions = canEditCanvas ? {
    canMoveUp: canvasSelectedIndex > 0,
    canMoveDown: canvasSelectedIndex >= 0 && canvasSelectedIndex < canvasNormalBlocks.length - 1,
    canDuplicate: !!canvasSelectedBlock && canDuplicateScreenOrderBlock(canvasSelectedBlock),
    onAdd: () => editPanelProps.setAddOpen(true),
    onEdit: () => {
      if (!canvasSelectedBlock || typeof document === 'undefined') return;
      const settings = document.getElementById(`editor-block-settings-${canvasSelectedBlock.id}`);
      const first = settings?.querySelector('textarea:not([disabled]), input:not([disabled]):not([type="checkbox"]), button:not([disabled])');
      const target = first || settings;
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      target?.focus?.({ preventScroll: true });
    },
    onMoveUp: () => {
      if (canvasSelectedIndex > 0) editPanelProps.reorderToIndex?.(selectedBlockId, canvasSelectedIndex - 1);
    },
    onMoveDown: () => {
      if (canvasSelectedIndex >= 0 && canvasSelectedIndex < canvasNormalBlocks.length - 1) {
        editPanelProps.reorderToIndex?.(selectedBlockId, canvasSelectedIndex + 2);
      }
    },
    onDuplicate: () => {
      if (canvasSelectedBlock && canDuplicateScreenOrderBlock(canvasSelectedBlock)) {
        editPanelProps.duplicateBlock?.(selectedBlockId);
      }
    },
  } : null;

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
        selectedCanvasBlock={canvasSelectedBlock}
        canvasActions={canvasActions}
        onSelectPreviewBlock={selectPreviewBlockWithImage}
        onEditPreviewText={canUseBuilder && editWorkspace && startMode !== 'template' && !stylePanelProps?.hasPendingStyle ? editPreviewText : undefined}
        onReplacePreviewImage={canUseBuilder && editWorkspace && startMode !== 'template' && !stylePanelProps?.hasPendingStyle ? replacePreviewImage : undefined}
        onEditPreviewLinkItem={canUseBuilder && editWorkspace && startMode !== 'template' && !stylePanelProps?.hasPendingStyle ? editPreviewLinkItem : undefined}
        onEditPreviewBottomButton={canUseBuilder && editWorkspace && startMode !== 'template' && !stylePanelProps?.hasPendingStyle ? editPreviewBottomButton : undefined}
      />}
    </div>
  );
}
