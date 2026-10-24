import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { notify, paperLabel, userIdsByRole } from '../services/notify.js';
import { listPapers, requirePaper, requireStage } from '../services/papers.js';
import { gradeLabel } from '../utils/grades.js';
import * as v from '../utils/validate.js';

// Head of Department portal (mounted behind requireRole('HOD')).
const router = Router();

async function hodDeptId(userId) {
  const [u] = await query('SELECT dept_id FROM users WHERE user_id = ?', [userId]);
  return u?.dept_id;
}

router.get('/papers', async (req, res) => {
  res.json({ papers: await listPapers() });
});

/* ---------------- Lecturers ---------------- */

router.get('/lecturers', async (req, res) => {
  const lecturers = await query(
    `SELECT u.user_id, u.title, u.initials, u.surname, CONCAT_WS(' ', u.title, u.initials, u.surname) AS name,
            u.designation, u.grade_level, u.email, u.role, u.is_active, u.dept_id, d.dept_name, f.faculty_name,
            (SELECT GROUP_CONCAT(c.contact_no ORDER BY c.contact_no SEPARATOR ', ')
               FROM user_contact_numbers c WHERE c.user_id = u.user_id) AS contact_numbers,
            (SELECT COUNT(*) FROM subjects s WHERE s.lecturer_id = u.user_id) AS subject_count
     FROM users u
     LEFT JOIN departments d ON d.dept_id = u.dept_id
     LEFT JOIN faculties f ON f.faculty_id = d.faculty_id
     WHERE u.role IN ('LECTURER', 'HOD')
     ORDER BY f.faculty_name, d.dept_name, u.grade_level DESC, u.surname`,
  );
  res.json({ lecturers });
});

router.post('/lecturers', async (req, res) => {
  const b = req.body || {};
  const title = v.text(b.title, 'Title', { max: 20 });
  const initials = v.text(b.initials, 'Initials', { max: 30 });
  const surname = v.text(b.surname, 'Surname', { max: 80 });
  const grade = v.int(b.grade_level, 'Grade', { min: 1, max: 5 });
  const deptId = v.int(b.dept_id, 'Department');
  const email = v.email(b.email);
  const password = v.text(b.password, 'Temporary password', { max: 100 });
  if (password.length < 6) throw new HttpError(400, 'Temporary password must be at least 6 characters');
  const contacts = String(b.contact_numbers || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  for (const c of contacts) {
    if (!/^[0-9+\s-]{7,20}$/.test(c)) throw new HttpError(400, `"${c}" is not a valid contact number`);
  }
  const [dept] = await query('SELECT dept_id FROM departments WHERE dept_id = ?', [deptId]);
  if (!dept) throw new HttpError(400, 'Please choose a valid department');

  const hash = await bcrypt.hash(password, 10);
  const userId = await withTransaction(async (conn) => {
    const r = await conn.q(
      `INSERT INTO users (title, initials, surname, designation, email, password_hash, role, grade_level, dept_id)
       VALUES (?, ?, ?, ?, ?, ?, 'LECTURER', ?, ?)`,
      [title, initials, surname, gradeLabel(grade), email, hash, grade, deptId],
    );
    if (contacts.length) {
      await conn.q('INSERT IGNORE INTO user_contact_numbers (user_id, contact_no) VALUES ?', [
        contacts.map((c) => [r.insertId, c]),
      ]);
    }
    return r.insertId;
  });
  res.status(201).json({ user_id: userId, message: 'Lecturer account created' });
});

router.patch('/lecturers/:id/status', async (req, res) => {
  const active = req.body?.is_active ? 1 : 0;
  const r = await query("UPDATE users SET is_active = ? WHERE user_id = ? AND role = 'LECTURER'", [
    active,
    req.params.id,
  ]);
  if (!r.affectedRows) throw new HttpError(404, 'Lecturer not found');
  res.json({ message: active ? 'Account activated' : 'Account deactivated' });
});

/* ---------------- Subjects ---------------- */

router.get('/subjects', async (req, res) => {
  const subjects = await query(
    `SELECT s.*, NULLIF(CONCAT_WS(' ', u.title, u.initials, u.surname), '') AS lecturer_name, d.dept_name
     FROM subjects s
     LEFT JOIN users u ON u.user_id = s.lecturer_id
     LEFT JOIN departments d ON d.dept_id = s.dept_id
     ORDER BY s.year_of_study, s.semester, s.subject_code`,
  );
  res.json({ subjects });
});

async function subjectFields(b) {
  const fields = {
    subject_name: v.text(b.subject_name, 'Subject name', { max: 150 }),
    credits: v.int(b.credits, 'Credits', { min: 1, max: 6 }),
    year_of_study: v.int(b.year_of_study, 'Year', { min: 1, max: 4 }),
    semester: v.int(b.semester, 'Semester', { min: 1, max: 2 }),
    lecturer_id: v.int(b.lecturer_id, 'Lecturer', { required: false }),
  };
  if (fields.lecturer_id) {
    const [l] = await query("SELECT user_id FROM users WHERE user_id = ? AND role = 'LECTURER' AND is_active = 1", [
      fields.lecturer_id,
    ]);
    if (!l) throw new HttpError(400, 'Please choose an active lecturer');
  }
  return fields;
}

router.post('/subjects', async (req, res) => {
  const code = v.text(req.body?.subject_code, 'Subject code', { max: 20 }).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]{2,6}\d{3,5}$/.test(code)) throw new HttpError(400, 'Subject code should look like ICT1407');
  const f = await subjectFields(req.body || {});
  await query(
    `INSERT INTO subjects (subject_code, subject_name, credits, year_of_study, semester, dept_id, lecturer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code, f.subject_name, f.credits, f.year_of_study, f.semester, await hodDeptId(req.user.user_id), f.lecturer_id],
  );
  res.status(201).json({ message: `Subject ${code} added` });
});

router.put('/subjects/:code', async (req, res) => {
  const f = await subjectFields(req.body || {});
  const r = await query(
    `UPDATE subjects SET subject_name = ?, credits = ?, year_of_study = ?, semester = ?, lecturer_id = ?
     WHERE subject_code = ?`,
    [f.subject_name, f.credits, f.year_of_study, f.semester, f.lecturer_id, req.params.code],
  );
  if (!r.affectedRows) throw new HttpError(404, 'Subject not found');
  res.json({ message: 'Subject updated' });
});

/* ---------------- Examinations & timetable ---------------- */

router.get('/examinations', async (req, res) => {
  const examinations = await query(
    `SELECT e.*, DATEDIFF(e.end_date, e.start_date) + 1 AS duration_days,
            CONCAT_WS(' ', u.title, u.initials, u.surname) AS prepared_by_name,
            (SELECT COUNT(*) FROM exam_papers p WHERE p.exam_id = e.exam_id) AS paper_count
     FROM examinations e JOIN users u ON u.user_id = e.prepared_by
     ORDER BY e.start_date DESC`,
  );
  res.json({ examinations });
});

router.post('/examinations', async (req, res) => {
  const b = req.body || {};
  const name = v.text(b.exam_name, 'Examination name', { max: 150 });
  const academicYear = v.text(b.academic_year, 'Academic year', { max: 20 });
  const year = v.int(b.year_of_study, 'Year', { min: 1, max: 4 });
  const semester = v.int(b.semester, 'Semester', { min: 1, max: 2 });
  const start = v.date(b.start_date, 'Start date');
  const end = v.date(b.end_date, 'End date');
  if (end < start) throw new HttpError(400, 'End date must be on or after the start date');
  const r = await query(
    `INSERT INTO examinations (exam_name, academic_year, year_of_study, semester, start_date, end_date, prepared_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, academicYear, year, semester, start, end, req.user.user_id],
  );
  res.status(201).json({ exam_id: r.insertId, message: 'Examination created' });
});

router.get('/examinations/:id', async (req, res) => {
  const [exam] = await query(
    `SELECT e.*, DATEDIFF(e.end_date, e.start_date) + 1 AS duration_days FROM examinations e WHERE e.exam_id = ?`,
    [req.params.id],
  );
  if (!exam) throw new HttpError(404, 'Examination not found');
  res.json({ exam, papers: await listPapers('p.exam_id = ?', [exam.exam_id]) });
});

router.post('/examinations/:id/papers', async (req, res) => {
  const b = req.body || {};
  const [exam] = await query('SELECT * FROM examinations WHERE exam_id = ?', [req.params.id]);
  if (!exam) throw new HttpError(404, 'Examination not found');
  const code = v.text(b.subject_code, 'Subject');
  const examDate = v.date(b.exam_date, 'Exam date');
  const start = v.time(b.start_time, 'Start time');
  const end = v.time(b.end_time, 'End time');
  const venue = v.text(b.venue, 'Venue', { max: 100 });
  if (examDate < exam.start_date || examDate > exam.end_date) {
    throw new HttpError(400, `Exam date must be between ${exam.start_date} and ${exam.end_date}`);
  }
  if (end <= start) throw new HttpError(400, 'End time must be after the start time');
  const [subject] = await query('SELECT subject_code FROM subjects WHERE subject_code = ?', [code]);
  if (!subject) throw new HttpError(400, 'Subject not found');
  const clash = await query(
    `SELECT s.subject_code FROM exam_papers p JOIN subjects s ON s.subject_code = p.subject_code
     WHERE p.exam_date = ? AND p.venue = ? AND p.start_time < ? AND p.end_time > ?`,
    [examDate, venue, end, start],
  );
  if (clash.length) throw new HttpError(400, `${venue} is already booked for ${clash[0].subject_code} at that time`);
  try {
    await query(
      `INSERT INTO exam_papers (exam_id, subject_code, exam_date, start_time, end_time, venue)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [exam.exam_id, code, examDate, start, end, venue],
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, `${code} is already in this timetable`);
    throw err;
  }
  res.status(201).json({ message: `${code} added to the timetable` });
});

router.delete('/papers/:id', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['SCHEDULED'], 'Only papers whose scripts have not reached the AR office can be removed');
  await query('DELETE FROM exam_papers WHERE paper_id = ?', [paper.paper_id]);
  res.json({ message: `${paper.subject_code} removed from the timetable` });
});

/* ---------------- Final marksheet approval ---------------- */

router.post('/papers/:id/approve', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['FINAL_SUBMITTED'], 'There is no final marksheet waiting for approval');
  const comment = v.text(req.body?.comment, 'Comment', { required: false });
  await query(
    `UPDATE final_marksheets SET approval_status = 'APPROVED', approved_by = ?, approved_at = NOW(), hod_comment = ?
     WHERE paper_id = ?`,
    [req.user.user_id, comment, paper.paper_id],
  );
  await notify({
    senderId: req.user.user_id,
    receiverIds: [paper.lecturer_id],
    paperId: paper.paper_id,
    type: 'FINAL_APPROVED',
    message: `Your final marksheet for ${paperLabel(paper)} has been approved by the HOD.`,
  });
  res.json({ message: 'Final marksheet approved' });
});

router.post('/papers/:id/reject', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['FINAL_SUBMITTED'], 'There is no final marksheet waiting for approval');
  const comment = v.text(req.body?.comment, 'Reason for returning');
  await query(
    `UPDATE final_marksheets SET approval_status = 'REJECTED', approved_by = ?, approved_at = NOW(), hod_comment = ?
     WHERE paper_id = ?`,
    [req.user.user_id, comment, paper.paper_id],
  );
  await notify({
    senderId: req.user.user_id,
    receiverIds: [paper.lecturer_id],
    paperId: paper.paper_id,
    type: 'FINAL_RETURNED',
    message: `The HOD returned your final marksheet for ${paperLabel(paper)} for correction: "${comment}"`,
  });
  res.json({ message: 'Final marksheet returned to the lecturer' });
});

router.post('/papers/:id/send-to-branch', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['APPROVED'], 'Only approved final marksheets can be sent to the Exam Branch');
  await query('UPDATE final_marksheets SET sent_to_exam_branch_at = NOW() WHERE paper_id = ?', [paper.paper_id]);
  await notify({
    senderId: req.user.user_id,
    receiverIds: [paper.lecturer_id, ...(await userIdsByRole('AR'))],
    paperId: paper.paper_id,
    type: 'SENT_TO_EXAM_BRANCH',
    message: `The approved final marksheet for ${paperLabel(paper)} was sent to the Exam Information Branch.`,
  });
  res.json({ message: 'Sent to the Exam Information Branch' });
});

export default router;
