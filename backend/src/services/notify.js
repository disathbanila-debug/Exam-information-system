import { query } from '../db.js';

export async function userIdsByRole(role) {
  const rows = await query('SELECT user_id FROM users WHERE role = ? AND is_active = 1', [role]);
  return rows.map((r) => r.user_id);
}

/** Inserts one notification per receiver. */
export async function notify({ senderId = null, receiverIds, paperId = null, type, message }) {
  const ids = [...new Set(receiverIds.filter(Boolean))];
  if (!ids.length) return;
  await query(
    'INSERT INTO notifications (sender_id, receiver_id, paper_id, notif_type, message) VALUES ?',
    [ids.map((id) => [senderId, id, paperId, type, message])],
  );
}

export const paperLabel = (p) => `${p.subject_code} – ${p.subject_name} (${p.exam_name})`;
