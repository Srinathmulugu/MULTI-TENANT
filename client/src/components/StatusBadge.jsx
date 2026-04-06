const CLASS_BY_STATUS = {
  Pending: 'status-pending',
  'In Progress': 'status-progress',
  Completed: 'status-completed',
  Submitted: 'status-progress',
  Approved: 'status-completed',
  Rejected: 'status-rejected'
};

export default function StatusBadge({ status }) {
  return <span className={`status ${CLASS_BY_STATUS[status] || 'status-pending'}`}>{status}</span>;
}
