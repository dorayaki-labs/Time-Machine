import { useId } from 'react';
import Icon from './Icon.jsx';

export default function SearchBar({ value, onChange, placeholder = 'Search…', label = 'Search', className = '' }) {
  const id = useId();
  return (
    <div className={`searchbar ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Icon name="search" size={18} className="searchbar__icon" />
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      {value ? (
        <button type="button" className="searchbar__clear" onClick={() => onChange('')} aria-label="Clear search"><Icon name="close" size={16} /></button>
      ) : null}
    </div>
  );
}
