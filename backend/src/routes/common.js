import path from 'node:path';
import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { getMarksheets, requirePaper } from '../services/papers.js';
import { GRADES } from '../utils/grades.js';
import { STAGES } from '../utils/stage.js';

// Routes shared by all three portals.
const router = Router();
router.use(authenticate);

router.get('/lookups', async (req, res) => {
  const departments = await query(
    `SELECT d.dept_id, d.dept_name, f.faculty_name
     FROM departments d JOIN faculties f ON f.faculty_id = d.faculty_id
     ORDER BY f.faculty_name, d.dept_name`,
  );
  res.json({ departments, grades: GRADES, stages: STAGES });
});

router.get('/notifications', async (req, res) => {
  const notifications = await query(
    `SELECT n.notification_id, n.notif_type, n.message, n.sent_at, n.is_read, n.paper_id,
            NULLIF(CONCAT_WS(' ', s.title, s.initials, s.surname), '') AS sender_name, s.role AS sender_role
     FROM notifications n LEFT JOIN users s ON s.user_id = n.sender_id
     WHERE n.receiver_id = ? ORDER BY n.sent_at DESC, n.notification_id DESC LIMIT 200`,
    [req.user.user_id],
  );
  res.json({ notifications });
});

router.get('/notifications/unread-count', async (req, res) => {
  const [r] = await query('SELECT COUNT(*) AS count FROM notifications WHERE receiver_id = ? AND is_read = 0', [
    req.user.user_id,
  ]);
  res.json({ count: r.count });
});

router.patch('/notifications/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE receiver_id = ?', [req.user.user_id]);
  res.json({ ok: true });
});

router.patch('/notifications/:id/read', async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND receiver_id = ?', [
    req.params.id,
    req.user.user_id,
  ]);
  res.json({ ok: true });
});

router.get('/papers/:id', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  if (req.user.role === 'LECTURER' && paper.lecturer_id !== req.user.user_id) {
    throw new HttpError(403, 'This exam paper is not assigned to you');
  }
  res.json({ paper, marksheets: await getMarksheets(paper.paper_id) });
});

// Uploaded PDFs: any HOD/AR user may open them; a lecturer only for their own papers.
router.get('/files/:name', async (req, res) => {
  const name = path.basename(req.params.name);
  const owners = await query(
    `SELECT paper_id FROM detail_marksheets WHERE marksheet_pdf = ?
     UNION SELECT paper_id FROM second_marker_reports WHERE report_pdf = ?
     UNION SELECT paper_id FROM final_marksheets WHERE final_pdf = ?`,
    [name, name, name],
  );
  if (!owners.length) throw new HttpError(404, 'File not found');
  if (req.user.role === 'LECTURER') {
    const [own] = await query(
      `SELECT 1 AS ok FROM exam_papers p JOIN subjects s ON s.subject_code = p.subject_code
       WHERE p.paper_id = ? AND s.lecturer_id = ?`,
      [owners[0].paper_id, req.user.user_id],
    );
    if (!own) throw new HttpError(403, 'You do not have access to this file');
  }
  res.sendFile(path.join(UPLOAD_DIR, name), (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'File not found on the server' });
  });
});

export default router;
