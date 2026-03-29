const CLASS_BY_STATUS = {
  Pending: 'badge-pending',
  'In Progress': 'badge-progress',
  Completed: 'badge-completed'
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge ${CLASS_BY_STATUS[status] || 'badge-pending'}`}>{status}</span>;
}
