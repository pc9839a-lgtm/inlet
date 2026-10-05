import { useEffect, useState } from 'react';

const MOBILE_WORKSPACE_QUERY = '(max-width: 899px)';
const COARSE_POINTER_QUERY = '(pointer: coarse)';

function matchesMobileWorkspace() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_WORKSPACE_QUERY).matches
    && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

export function useMobileWorkspaceMode() {
  const [mobile, setMobile] = useState(matchesMobileWorkspace);

  useEffect(() => {
    const widthMedia = window.matchMedia(MOBILE_WORKSPACE_QUERY);
    const pointerMedia = window.matchMedia(COARSE_POINTER_QUERY);
    const update = () => setMobile(widthMedia.matches && pointerMedia.matches);

    update();
    widthMedia.addEventListener('change', update);
    pointerMedia.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      widthMedia.removeEventListener('change', update);
      pointerMedia.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return mobile;
}
