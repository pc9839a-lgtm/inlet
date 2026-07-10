export function shouldShowStartModeOverlay({ canManageAdmin, startMode, tabDeepLink } = {}) {
  return Boolean(canManageAdmin && !startMode && !tabDeepLink);
}
