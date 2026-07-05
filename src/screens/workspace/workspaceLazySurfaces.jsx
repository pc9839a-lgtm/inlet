import { lazy } from 'react';

export const PreviewRenderer = lazy(() => import('../../preview/LandingRenderer.jsx'));
export const InboxPanel = lazy(() => import('../../panels/InboxPanel.jsx'));
export const StatsPanel = lazy(() => import('../../panels/StatsPanel.jsx'));
export const StylePanel = lazy(() => import('../../panels/StylePanel.jsx'));
export const SettingsPanel = lazy(() => import('../../panels/SettingsPanel.jsx'));
export const TemplatesPanel = lazy(() => import('../../panels/TemplatesPanel'));
export const CreateLandingModal = lazy(() => import('../CreateLandingFlow.jsx').then((module) => ({ default: module.CreateLandingModal })));