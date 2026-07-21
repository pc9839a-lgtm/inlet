import { useEffect, useRef, useState } from 'react';
import {
  createBasicDraft,
  createConversionReady,
  createSeoDraft,
  createTrackingDraft,
  hasAnyConversionValue,
  hasConversionMeta,
  isBasicDraftDirty,
  SETTINGS_LOCKED_INITIAL,
} from './settingsDraftModel.js';
import {
  persistBasicDraft,
  persistConversionValues,
  persistSeoDraft,
  persistTrackingDraft,
  updateConversionDraft,
} from './settingsDraftActions.js';

export default function useSettingsDrafts({
  onCheckUrl,
  onSavePage,
  openSection,
  page,
  updateMeta,
  updatePage,
}) {
  const [conversionLocked, setConversionLocked] = useState(() => hasConversionMeta(page));
  const [lockedSections, setLockedSections] = useState(SETTINGS_LOCKED_INITIAL);
  const [basicDraft, setBasicDraft] = useState(() => createBasicDraft(page));
  const basicSourceRef = useRef(createBasicDraft(page));
  const [seoDraft, setSeoDraft] = useState(() => createSeoDraft(page));
  const [trackingDraft, setTrackingDraft] = useState(() => createTrackingDraft(page));

  const conversionReady = createConversionReady(page);
  const hasConversionValue = hasAnyConversionValue(conversionReady);
  const showConversionToggles = conversionLocked && hasConversionValue;

  const lockSection = (id) => setLockedSections((state) => ({ ...state, [id]: true }));
  const editSection = (id) => setLockedSections((state) => ({ ...state, [id]: false }));

  useEffect(() => {
    const nextSource = createBasicDraft(page);
    setBasicDraft((draft) => {
      const previousSource = basicSourceRef.current || createBasicDraft();
      const draftDirty = isBasicDraftDirty(draft, previousSource);
      basicSourceRef.current = nextSource;
      if (openSection === 'basic' && !lockedSections.basic && draftDirty) return draft;
      return nextSource;
    });
  }, [page.title, page.slug, openSection, lockedSections.basic]);

  const saveBasic = () => persistBasicDraft({
    basicDraft,
    basicSourceRef,
    lockSection,
    onCheckUrl,
    onSavePage,
    page,
    setBasicDraft,
    updatePage,
  });

  const saveSeo = () => persistSeoDraft({ lockSection, onSavePage, page, seoDraft, updateMeta });
  const saveTracking = () => persistTrackingDraft({ lockSection, trackingDraft, updateMeta });
  const updateConversionMeta = (patch) => updateConversionDraft({ patch, setConversionLocked, updateMeta });
  const saveConversionValues = () => persistConversionValues({ hasConversionValue, setConversionLocked });

  return {
    basicDraft,
    conversionLocked,
    conversionReady,
    editSection,
    hasConversionValue,
    lockedSections,
    lockSection,
    saveBasic,
    saveConversionValues,
    saveSeo,
    saveTracking,
    seoDraft,
    setBasicDraft,
    setConversionLocked,
    setSeoDraft,
    setTrackingDraft,
    showConversionToggles,
    trackingDraft,
    updateConversionMeta,
  };
}