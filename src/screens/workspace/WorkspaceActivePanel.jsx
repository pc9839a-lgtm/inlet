import React, { Suspense } from 'react';
import EditPanel from '../../editor/EditPanel.jsx';
import { LazyChunkBoundary, LazyPanelFallback } from '../../runtime/LazyRuntimeBoundary.jsx';
import {
  InboxPanel,
  SettingsPanel,
  StatsPanel,
  StylePanel,
} from '../../runtime/lazySurfaces.jsx';

export function WorkspaceActivePanel({
  canUseBuilder,
  tab,
  editPanelProps,
  stylePanelProps,
  inboxPanelProps,
  statsPanelProps,
  settingsPanelProps,
}) {
  return (
    <>
      {canUseBuilder && tab === 'edit' && <EditPanel {...editPanelProps} />}

      <LazyChunkBoundary resetKey={tab}>
        <Suspense fallback={<LazyPanelFallback />}>
          {canUseBuilder && tab === 'style' && <StylePanel {...stylePanelProps} />}
          {tab === 'inbox' && <InboxPanel {...inboxPanelProps} />}
          {tab === 'stats' && <StatsPanel {...statsPanelProps} />}
          {tab === 'settings' && <SettingsPanel {...settingsPanelProps} />}
        </Suspense>
      </LazyChunkBoundary>
    </>
  );
}