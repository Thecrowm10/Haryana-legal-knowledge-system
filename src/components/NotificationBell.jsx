import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, FileText, CheckCircle, XCircle } from 'lucide-react';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../services/notifications';

const TYPE_META = {
  new_upload:         { icon: FileText,     color: '#3b82f6', bg: 'rgba(59,130,246,.1)',  label: 'New Upload' },
  document_approved:  { icon: CheckCircle,  color: '#22c55e', bg: 'rgba(34,197,94,.1)',   label: 'Approved' },
  document_rejected:  { icon: XCircle,      color: '#ef4444', bg: 'rgba(239,68,68,.1)',   label: 'Rejected' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell({ role }) {
  const [open, setOpen]         = useState(false);
  const [notifs, setNotifs]     = useState([]);
  const [unread, setUnread]     = useState(0);
  const ref                     = useRef(null);

  function refresh() {
    setNotifs(getNotifications(role));
    setUnread(getUnreadCount(role));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [role]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    setOpen(o => !o);
    refresh();
  }

  function handleMarkRead(id) {
    markRead(id);
    refresh();
  }

  function handleMarkAll() {
    markAllRead(role);
    refresh();
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 9, border: '1px solid var(--surface-border)',
          background: open ? 'var(--surface-ground)' : 'transparent',
          cursor: 'pointer', color: 'var(--text-color-secondary)', transition: 'all .15s',
        }}
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 9, padding: '0 4px',
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            fontFamily: 'var(--mono)', border: '2px solid var(--surface-card)',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 42, right: 0, zIndex: 999,
          width: 340, borderRadius: 12,
          background: 'var(--surface-card)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 12px 40px rgba(0,0,0,.15)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>
              Notifications {unread > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginLeft: 4 }}>({unread} new)</span>}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAll} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)' }}>
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>
                <Bell size={24} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                No notifications yet
              </div>
            ) : (
              notifs.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.new_upload;
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkRead(n.id)}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 16px',
                      borderBottom: '1px solid var(--surface-border)',
                      background: n.read ? 'transparent' : 'rgba(59,130,246,.04)',
                      cursor: 'pointer', transition: 'background .12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(59,130,246,.04)'}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.bg, border: `1px solid ${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color={meta.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)' }}>{n.title}</span>
                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word' }}>{n.message}</div>
                      {n.remark && (
                        <div style={{
                          marginTop: 6, padding: '6px 9px',
                          background: n.type === 'document_rejected' ? 'rgba(239,68,68,.07)' : 'rgba(34,197,94,.07)',
                          border: `1px solid ${n.type === 'document_rejected' ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                          borderLeft: `3px solid ${n.type === 'document_rejected' ? '#ef4444' : '#22c55e'}`,
                          borderRadius: 6,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: n.type === 'document_rejected' ? '#ef4444' : '#16a34a', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            {n.type === 'document_rejected' ? 'Reason for Rejection' : 'Approver Remarks'}
                          </div>
                          <div style={{ fontSize: 11.5, color: n.type === 'document_rejected' ? '#b91c1c' : '#15803d', lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word' }}>{n.remark}</div>
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', marginTop: 4, opacity: 0.6 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
