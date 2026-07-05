import { useState } from 'react';

export default function useSettingsPanelSections() {
  const [openSection, setOpenSection] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return {
    advancedOpen,
    openSection,
    setAdvancedOpen,
    setOpenSection,
  };
}