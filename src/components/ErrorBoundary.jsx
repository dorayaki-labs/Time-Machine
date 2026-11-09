import { Component } from 'react';
import Icon from './Icon.jsx';

/**
 * Last line of defence: a record or component that throws shows a friendly
 * card instead of an empty background. The data layer already normalizes
 * editor input, so reaching this means a genuine bug — the message asks for a
 * report the same way the rest of the archive does.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Time Machine: render error', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" role="alert">
          <span className="empty-state__icon" aria-hidden="true"><Icon name="archive" size={26} /></span>
          <h1>Something went wrong on this page</h1>
          <p>The error has been logged in the browser console. Refreshing usually helps; if it keeps happening, the record on this page may need fixing.</p>
          {this.state.error?.message
            ? <p className="mono small muted">Error: {String(this.state.error.message)}</p>
            : null}
          <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
