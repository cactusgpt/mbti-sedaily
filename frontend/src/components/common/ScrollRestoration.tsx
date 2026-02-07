import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollRestoration() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    if (pathname === '/') {
      const savedPosition = sessionStorage.getItem('homeScrollPosition');
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        setTimeout(() => {
          window.scrollTo({ top: position, left: 0, behavior: 'instant' });
        }, 50);
        sessionStorage.removeItem('homeScrollPosition');
      }
    }

    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && pathname === '/') {
        const url = new URL(link.href);
        if (url.origin === window.location.origin && !url.hash) {
          sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
        }
      }
    };

    document.addEventListener('click', handleLinkClick, true);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [pathname]);

  return null;
}
