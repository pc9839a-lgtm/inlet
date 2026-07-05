import React from 'react';

export function useSelectedSettingsScroll() {
  const selectedSettingsRef = React.useRef(null);

  const scrollToSelectedSettings = React.useCallback(() => {
    const run = typeof window !== 'undefined' && window.requestAnimationFrame
      ? window.requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    run(() => selectedSettingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  return { selectedSettingsRef, scrollToSelectedSettings };
}