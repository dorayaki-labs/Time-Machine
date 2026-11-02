export default function PageContainer({ children, narrow = false, className = '', as: Tag = 'div', ...rest }) {
  return <Tag className={`container${narrow ? ' container--narrow' : ''} ${className}`} {...rest}>{children}</Tag>;
}
