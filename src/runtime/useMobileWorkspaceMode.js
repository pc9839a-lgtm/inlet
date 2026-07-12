import { useEffect, useState } from 'react';

const MOBILE_WORKSPACE_QUERY = '(max-width: 899px)';

function matchesMobileWorkspace() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_WORKSPACE_QUERY).matches;
}

export function useMobileWorkspaceMode() {
  const [mobile, setMobile] = useState(matchesMobileWorkspace);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_WORKSPACE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return mobile;
}