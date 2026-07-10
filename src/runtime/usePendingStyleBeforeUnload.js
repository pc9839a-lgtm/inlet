import { useEffect } from 'react';

export function usePendingStyleBeforeUnload(hasPendingStyle) {
  useEffect(() => {
    if (!hasPendingStyle) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingStyle]);
}
