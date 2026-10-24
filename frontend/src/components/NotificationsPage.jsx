import { useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { fmtDateTime, timeAgo } from '../utils/format.js';
import { useApi } from '../utils/useApi.js';
import { EmptyState, ErrorBox, Loader, PageHeader } from './ui.jsx';

const TYPE_LABEL = {
  SCRIPTS_READY: 'Scripts ready',
  SCRIPTS_COLLECTED: 'Collection recorded',
  EXAMINER_NOMINATED: '2nd examiner',
  MARKSHEET_SUBMITTED: 'Marking report',
  SECOND_REPORT_ARRIVED: '2nd marker report',
  DOCUMENTS_FORWARDED: 'Documents',
  FINAL_SUBMITTED: 'Final marksheet',
  FINAL_APPROVED: 'Approved',
  FINAL_RETURNED: 'Returned',
  SENT_TO_EXAM_BRANCH: 'Exam Branch',
};

export default function NotificationsPage() {
  const { data, loading, error, reload } = useApi('/notifications');
  const { refreshUnread } = useOutletContext();
  const toast = useToast();

  async function markRead(n) {
    if (n.is_read) return;
    await api(`/notifications/${n.notification_id}/read`, { method: 'PATCH' }).catch(() => {});
    reload();
    refreshUnread();
  }

  async function markAll() {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      reload();
      refreshUnread();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const list = data?.notifications || [];
  const unread = list.filter((n) => !n.is_read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        actions={
          unread > 0 && (
            <button className="btn btn-outline" onClick={markAll}>
              Mark all as read
            </button>
          )
        }
      />
      {loading && !data && <Loader />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && !list.length && <EmptyState title="No notifications yet" />}
      <div className="notif-list">
        {list.map((n) => (
          <button key={n.notification_id} className={`notif ${n.is_read ? '' : 'unread'}`} onClick={() => markRead(n)}>
            <span className="notif-dot" />
            <div className="notif-body">
              <div className="notif-top">
                <span className="badge tone-gray">{TYPE_LABEL[n.notif_type] || n.notif_type}</span>
                <span className="muted small" title={fmtDateTime(n.sent_at)}>
                  {timeAgo(n.sent_at)}
                </span>
              </div>
              <div className="notif-msg">{n.message}</div>
              {n.sender_name && <div className="muted small">From {n.sender_name}</div>}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
