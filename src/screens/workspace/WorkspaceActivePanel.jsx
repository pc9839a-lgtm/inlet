import React, { Suspense } from 'react';
import EditPanel from '../../editor/EditPanel.jsx';
import { LazyChunkBoundary, LazyPanelFallback } from '../../runtime/LazyRuntimeBoundary.jsx';
import {
  InboxPanel,
  SettingsPanel,
  StatsPanel,
  StylePanel,
} from './workspaceLazySurfaces.jsx';

export function WorkspaceActivePanel({
  canUseBuilder,
  mobileOperationsOnly,
  tab,
  editPanelProps,
  stylePanelProps,
  inboxPanelProps,
  statsPanelProps,
  settingsPanelProps,
}) {
  const canRenderBuilder = canUseBuilder && !mobileOperationsOnly;

  if (mobileOperationsOnly && !['inbox', 'stats'].includes(tab)) {
    return (
      <section className="mobile-operations-empty">
        <h2>모바일 운영 권한이 없습니다.</h2>
        <p>접수함 또는 통계 읽기 권한이 필요합니다.</p>
      </section>
    );
  }

  return (
    <>
      {canRenderBuilder && tab === 'edit' && <EditPanel {...editPanelProps} />}

      <LazyChunkBoundary resetKey={tab}>
        <Suspense fallback={<LazyPanelFallback />}>
          {canRenderBuilder && tab === 'style' && <StylePanel {...stylePanelProps} />}
          {tab === 'inbox' && <InboxPanel {...inboxPanelProps} />}
          {tab === 'stats' && <StatsPanel {...statsPanelProps} />}
          {!mobileOperationsOnly && tab === 'settings' && <SettingsPanel {...settingsPanelProps} />}
        </Suspense>
      </LazyChunkBoundary>
    </>
  );
}