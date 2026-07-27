import { useRef, useState } from 'react';
import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { attachExistingPageIdentity } from './savePageIdentity.js';
import {
  SAVE_BLOCKED_FEEDBACK,
  STYLE_CONFIRM_FEEDBACK,
  WRITE_BLOCKED_FEEDBACK,
} from './pageSaveFeedback.js';
import { commitSavedPageResult, handlePagePersistError } from './pagePersistFlow.js';

export function usePageSaveAction({
  allowedTabs,
  tab,
  canWriteCurrentTab,
  hasPendingStyle,
  page,
  authUser,
  latestPageRef,
  requestConfirm,
  persistStyleNow,
  pageForAccountSave,
  savedPageFromResult,
  handlePageSaveError,
  markSaveStatus,
  saveLocalJson,
  showToast,
  setConnectionsEditing,
  setPage,
  setSaved,
}) {
  const saveInFlightRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const saveNow = async (pageOverride = null) => {
    if (saveInFlightRef.current) return { ok: false, reason: 'save-in-progress' };
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      if (!allowedTabs.includes(tab)) {
        markSaveStatus(SAVE_BLOCKED_FEEDBACK.level, SAVE_BLOCKED_FEEDBACK.title, SAVE_BLOCKED_FEEDBACK.message);
        return { ok: false, reason: 'tab-blocked' };
      }
      if (!canWriteCurrentTab) {
        markSaveStatus(WRITE_BLOCKED_FEEDBACK.level, WRITE_BLOCKED_FEEDBACK.title, WRITE_BLOCKED_FEEDBACK.message);
        showToast(WRITE_BLOCKED_FEEDBACK.toast, WRITE_BLOCKED_FEEDBACK.level);
        return { ok: false, reason: 'write-blocked' };
      }
      if (tab === 'style' && hasPendingStyle) {
        requestConfirm({
          title: STYLE_CONFIRM_FEEDBACK.title,
          message: STYLE_CONFIRM_FEEDBACK.message,
          confirmLabel: STYLE_CONFIRM_FEEDBACK.confirmLabel,
          onConfirm: persistStyleNow,
        });
        return { ok: false, reason: 'style-confirm-required' };
      }

      const sourcePage = pageOverride
        ? normalizePageForSave({ ...(latestPageRef.current || page), ...pageOverride })
        : (latestPageRef.current || page);
      const saveSourcePage = await attachExistingPageIdentity(sourcePage, {
        authUser,
        latestPage: latestPageRef.current,
        currentPage: page,
      });
      const expectedUpdatedAt = saveSourcePage.updatedAt || saveSourcePage.savedAt || saveSourcePage.createdAt || sourcePage.updatedAt || sourcePage.savedAt || sourcePage.createdAt || '';
      const nextPage = pageForAccountSave(saveSourcePage);
      let result = null;
      try {
        result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, saveMode: 'update-existing' });
      } catch (error) {
        await handlePagePersistError({ error, page: nextPage, handlePageSaveError, markSaveStatus, showToast });
        return { ok: false, error };
      }
      setConnectionsEditing(false);
      const savedPage = commitSavedPageResult({
        result,
        nextPage,
        scope: 'page',
        latestPageRef,
        savedPageFromResult,
        saveLocalJson,
        setPage,
        setSaved,
        markSaveStatus,
      });
      return { ok: true, page: savedPage, result };
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  return { saveNow, saving };
}
