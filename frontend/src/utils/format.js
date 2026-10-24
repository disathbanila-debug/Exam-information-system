const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

export function fmtDate(v) {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hh = Number(h);
  return `${((hh + 11) % 12) + 1}:${m} ${hh < 12 ? 'AM' : 'PM'}`;
}

export function fmtDateTime(v) {
  if (!v) return '—';
  return `${fmtDate(v)}, ${fmtTime(String(v).slice(11, 16))}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowLocalInput() {
  const d = new Date();
  return `${todayISO()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const paperTitle = (p) => `${p.subject_code} – ${p.subject_name}`;

export function daysText(n) {
  if (n === null || n === undefined) return '';
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`;
  if (n === 0) return 'due today';
  return `${n} day${n === 1 ? '' : 's'} left`;
}

export function timeAgo(v) {
  const then = new Date(String(v).replace(' ', 'T'));
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(v);
}
