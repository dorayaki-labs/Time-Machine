import { useEffect } from 'react';
import { SITE_NAME } from '@/config.js';

// The browser tab title is the site name, with the page as context when useful.
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
