import React from 'react';
import { CreateLandingModal, TemplatesPanel } from './workspaceLazySurfaces.jsx';

export function WorkspaceCreateModalLayer({
  show,
  page,
  onClose,
  createWithAi,
  createManual,
  createFromTemplate,
  onCheckUrl,
  defaultSlug,
  templates,
}) {
  if (!show) return null;

  return (
    <CreateLandingModal
      page={page}
      onClose={onClose}
      onAi={createWithAi}
      onManual={createManual}
      onTemplate={createFromTemplate}
      onCheckUrl={onCheckUrl}
      defaultSlug={defaultSlug}
      templates={templates}
      TemplatesPanelComponent={TemplatesPanel}
    />
  );
}