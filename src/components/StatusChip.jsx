import { STATUS_LABELS } from '@/lib/stats.js';

export default function StatusChip({ status }) {
  return <span className={`chip chip--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}
