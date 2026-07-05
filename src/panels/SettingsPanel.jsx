import { isServerPageMode } from '../config/runtimeConfig.js';
import {
  isClientAdminMode,
  isManagerMode,
  normalizeOwnershipSettings,
} from '../lib/authContext.js';
import { normalizeIntegrations } from '../lib/pageModel.js';
import SettingsPanelBody from './settings/SettingsPanelBody.jsx';
import useManagerSettings from './settings/useManagerSettings.js';
import usePageDuplicateSettings from './settings/usePageDuplicateSettings.js';
import useSettingsDrafts from './settings/useSettingsDrafts.js';
import useSettingsPanelSections from './settings/useSettingsPanelSections.js';
import './SettingsPanel.css';

export default function SettingsPanel({
  page,
  updatePage,
  updateMeta,
  updateIntegrations,
  onSavePage,
  onDuplicatePage,
  onCheckUrl,
  canDuplicatePage = false,
  onReset,
  authUser = null,
  accessMode = 'builder',
  onAccountUpdate,
  onLogout,
}) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const ownership = normalizeOwnershipSettings(page, authUser);
  const managers = ownership.managers || [];
  const transferRequest = page.ownership?.transferRequest || null;
  const serverPage = isServerPageMode();
  const clientAdminMode = isClientAdminMode(accessMode);
  const managerMode = isManagerMode(accessMode);
  const canManageProjectUsers = !managerMode;
  const sections = useSettingsPanelSections();
  const drafts = useSettingsDrafts({
    onCheckUrl,
    onSavePage,
    openSection: sections.openSection,
    page,
    updateMeta,
    updatePage,
  });
  const managerSettings = useManagerSettings({
    authUser,
    editSection: drafts.editSection,
    lockSection: drafts.lockSection,
    managers,
    ownership,
    page,
    serverPage,
    updatePage,
  });
  const duplicateSettings = usePageDuplicateSettings({
    canDuplicatePage,
    onDuplicatePage,
    page,
  });

  return (
    <SettingsPanelBody
      authUser={authUser}
      canDuplicatePage={canDuplicatePage}
      canManageProjectUsers={canManageProjectUsers}
      clientAdminMode={clientAdminMode}
      duplicateSettings={duplicateSettings}
      drafts={drafts}
      integrations={integrations}
      managerSettings={managerSettings}
      onAccountUpdate={onAccountUpdate}
      onLogout={onLogout}
      onReset={onReset}
      ownership={ownership}
      page={page}
      sections={sections}
      transferRequest={transferRequest}
      updateIntegrations={updateIntegrations}
    />
  );
}