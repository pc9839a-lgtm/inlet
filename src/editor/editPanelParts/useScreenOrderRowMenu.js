import React from 'react';
import { stop } from './editorEvents.js';

export function useScreenOrderRowMenu() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const runAction = React.useCallback((handler, closeMenu = true) => (event) => {
    stop(event);
    handler?.(event);
    if (closeMenu) setMenuOpen(false);
  }, []);

  const toggleMenu = runAction(() => setMenuOpen((value) => !value), false);

  return {
    menuOpen,
    runAction,
    toggleMenu,
    stop,
  };
}