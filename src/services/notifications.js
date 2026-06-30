const KEY = 'hlks_notifications';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function createNotification({ toRole, type, title, message, docId, docTitle, uploaderName, remark }) {
  const items = load();
  const notif = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    toRole, type, title, message, docId, docTitle, uploaderName,
    remark: remark || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  items.unshift(notif);
  save(items.slice(0, 100)); // max 100 notifications
  return notif;
}

export function getNotifications(role) {
  return load().filter(n => n.toRole === role);
}

export function getUnreadCount(role) {
  return load().filter(n => n.toRole === role && !n.read).length;
}

export function markRead(id) {
  const items = load().map(n => n.id === id ? { ...n, read: true } : n);
  save(items);
}

export function markAllRead(role) {
  const items = load().map(n => n.toRole === role ? { ...n, read: true } : n);
  save(items);
}
