export default function LoadingState({ label = 'Loading…', inline = false }) {
  return (
    <div className={`loading-state${inline ? ' loading-state--inline' : ''}`} role="status" aria-live="polite">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
