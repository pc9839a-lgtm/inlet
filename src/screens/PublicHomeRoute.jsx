import { useEffect } from 'react';
import PageroCanonicalHome from './PageroCanonicalHome.jsx';

export default function PublicHomeRoute({ onLogin, onSignup }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.add('pagero-public-home-active');
    return () => {
      document.body.classList.remove('pagero-public-home-active');
    };
  }, []);

  return <PageroCanonicalHome onLogin={onLogin} onSignup={onSignup} />;
}
