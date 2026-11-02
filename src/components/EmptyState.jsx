import Icon from './Icon.jsx';

export default function EmptyState({ title, message, action, icon = 'archive', level: Heading = 'h3' }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__icon"><Icon name={icon} size={26} /></span>
      <Heading>{title}</Heading>
      {message ? <p>{message}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
