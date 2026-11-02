import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

export default function NotFound({ title = 'This page has slipped through time', message = 'The page you are looking for does not exist, or has been moved.' }) {
  useDocumentTitle('Page not found');
  return (
    <PageContainer narrow>
      <div className="not-found">
        <p className="not-found__code">404</p>
        <EmptyState
          icon="clock"
          level="h1"
          title={title}
          message={message}
          action={<div className="btn-row"><Link to="/" className="btn btn--primary">Back to home</Link><Link to="/search" className="btn btn--ghost">Search the archive</Link></div>}
        />
      </div>
    </PageContainer>
  );
}
