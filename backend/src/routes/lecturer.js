import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { requireFile, uploadPdf } from '../middleware/upload.js';
import { notify, paperLabel, userIdsByRole } from '../services/notify.js';
import { listPapers, requireOwnPaper, requireStage } from '../services/papers.js';
import * as v from '../utils/validate.js';

// Lecturer portal (mounted behind requireRole('LECTURER')).
const router = Router();

router.get('/papers', async (req, res) => {
  res.json({ papers: await listPapers('s.lecturer_id = ?', [req.user.user_id]) });
});

/* ---------------- Second examiner nomination ---------------- */

async function myGrade(userId) {
  const [me] = await query('SELECT grade_level FROM users WHERE user_id = ?', [userId]);
  return me?.grade_level ?? 0;
}

router.get('/examiner-options', async (req, res) => {
  const grade = await myGrade(req.user.user_id);
  const internal = await query(
    `SELECT u.user_id, CONCAT_WS(' ', u.title, u.initials, u.surname) AS name, u.designation, u.grade_level,
            d.dept_name, f.faculty_name
     FROM users u
     JOIN departments d ON d.dept_id = u.dept_id
     JOIN faculties f ON f.faculty_id = d.faculty_id
     WHERE u.role IN ('LECTURER', 'HOD') AND u.is_active = 1 AND u.user_id <> ? AND u.grade_level > ?
     ORDER BY u.grade_level DESC, u.surname`,
    [req.user.user_id, grade],
  );
  const external = await query('SELECT * FROM external_examiners ORDER BY name_with_initials');
  res.json({ my_grade: grade, internal, external });
});

router.post('/papers/:id/second-examiner', async (req, res) => {
  const paper = await requireOwnPaper(req.params.id, req.user.user_id);
  if (paper.dispatched_date) {
    throw new HttpError(400, 'The scripts were already couriered, so the second examiner can no longer change');
  }
  const b = req.body || {};
  let examinerName;

  const examinerId = await withTransaction(async (conn) => {
    if (b.examiner_type === 'INTERNAL') {
      const lecturerId = v.int(b.lecturer_id, 'Internal examiner');
      const [cand] = await conn.q(
        `SELECT user_id, grade_level, CONCAT_WS(' ', title, initials, surname) AS name
         FROM users WHERE user_id = ? AND role IN ('LECTURER', 'HOD') AND is_active = 1`,
        [lecturerId],
      );
      if (!cand) throw new HttpError(400, 'Please choose a valid internal lecturer');
      if (cand.user_id === req.user.user_id) throw new HttpError(400, 'You cannot be your own second examiner');
      if (cand.grade_level <= (await myGrade(req.user.user_id))) {
        throw new HttpError(400, 'An internal second examiner must hold a higher grade than you');
      }
      examinerName = cand.name;
      const [se] = await conn.q('SELECT examiner_id FROM second_examiners WHERE lecturer_id = ?', [lecturerId]);
      if (se) return se.examiner_id;
      return (await conn.q("INSERT INTO second_examiners (examiner_type, lecturer_id) VALUES ('INTERNAL', ?)", [lecturerId]))
        .insertId;
    }

    if (b.examiner_type === 'EXTERNAL') {
      let extId = v.int(b.ext_id, 'External examiner', { required: false });
      if (extId) {
        const [ext] = await conn.q('SELECT ext_id, title, name_with_initials FROM external_examiners WHERE ext_id = ?', [extId]);
        if (!ext) throw new HttpError(400, 'External examiner not found');
        examinerName = `${ext.title} ${ext.name_with_initials}`;
      } else {
        const e = b.external || {};
        const row = [
          v.text(e.title, 'Title', { max: 20 }),
          v.text(e.designation, 'Designation', { max: 80 }),
          v.text(e.name_with_initials, 'Name with initials', { max: 120 }),
          v.text(e.university, 'University', { max: 150 }),
          v.text(e.department, 'Department', { max: 150 }),
          v.text(e.address, 'Address'),
          v.email(e.email),
          v.text(e.contact_no, 'Contact number', { max: 20 }),
        ];
        extId = (
          await conn.q(
            `INSERT INTO external_examiners (title, designation, name_with_initials, university, department, address, email, contact_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            row,
          )
        ).insertId;
        examinerName = `${row[0]} ${row[2]}`;
      }
      const [se] = await conn.q('SELECT examiner_id FROM second_examiners WHERE ext_id = ?', [extId]);
      if (se) return se.examiner_id;
      return (await conn.q("INSERT INTO second_examiners (examiner_type, ext_id) VALUES ('EXTERNAL', ?)", [extId])).insertId;
    }

    throw new HttpError(400, 'Choose an internal or external examiner');
  });

  await query('UPDATE exam_papers SET second_examiner_id = ?, appointed_at = CURDATE(), appointed_by = ? WHERE paper_id = ?', [
    examinerId,
    req.user.user_id,
    paper.paper_id,
  ]);
  await notify({
    senderId: req.user.user_id,
    receiverIds: await userIdsByRole('AR'),
    paperId: paper.paper_id,
    type: 'EXAMINER_NOMINATED',
    message: `${examinerName} was nominated as the second examiner for ${paperLabel(paper)}.`,
  });
  res.json({ message: `${examinerName} nominated as second examiner` });
});

/* ---------------- Marking report / detail marksheet ---------------- */

router.post('/papers/:id/marksheets', uploadPdf, async (req, res) => {
  const paper = await requireOwnPaper(req.params.id, req.user.user_id);
  requireStage(
    paper,
    ['WITH_LECTURER', 'RETURNED_BY_LECTURER', 'DISPATCHED', 'WITH_SECOND_EXAMINER', 'SECOND_REPORT_RECEIVED', 'FORWARDED_TO_HOD', 'FINAL_REJECTED'],
    paper.stage === 'FINAL_SUBMITTED' || paper.stage === 'APPROVED' || paper.stage === 'SENT_TO_EXAM_BRANCH'
      ? 'The final marksheet has already been submitted'
      : 'You can submit the marking report after collecting the answer scripts',
  );
  const paperPct = v.decimal(req.body.paper_mark_pct, 'Paper %');
  const caPct = v.decimal(req.body.ca_mark_pct, 'CA %');
  if (paperPct + caPct !== 100) throw new HttpError(400, 'Paper % and CA % must add up to 100');
  const remarks = v.text(req.body.remarks, 'Remarks', { required: false });
  const file = requireFile(req);

  const version = await withTransaction(async (conn) => {
    const [r] = await conn.q('SELECT COALESCE(MAX(version_no), 0) + 1 AS next FROM detail_marksheets WHERE paper_id = ? FOR UPDATE', [
      paper.paper_id,
    ]);
    await conn.q(
      `INSERT INTO detail_marksheets (paper_id, version_no, marksheet_pdf, paper_mark_pct, ca_mark_pct, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paper.paper_id, r.next, file, paperPct, caPct, remarks],
    );
    return r.next;
  });

  await notify({
    senderId: req.user.user_id,
    receiverIds: await userIdsByRole('AR'),
    paperId: paper.paper_id,
    type: 'MARKSHEET_SUBMITTED',
    message: `${version === 1 ? 'Marking report' : `Corrected detail marksheet (version ${version})`} submitted for ${paperLabel(paper)}. Paper ${paperPct}% / CA ${caPct}%.`,
  });
  res.status(201).json({ message: `Detail marksheet version ${version} submitted` });
});

/* ---------------- Final marksheet ---------------- */

router.post('/papers/:id/final', uploadPdf, async (req, res) => {
  const paper = await requireOwnPaper(req.params.id, req.user.user_id);
  requireStage(
    paper,
    ['SECOND_REPORT_RECEIVED', 'FORWARDED_TO_HOD', 'FINAL_REJECTED'],
    paper.final_id ? 'The final marksheet is already with the HOD' : 'You can submit the final marksheet after the second marker report arrives',
  );
  if (!paper.latest_version) throw new HttpError(400, 'Submit your detail marksheet before the final marksheet');
  const file = requireFile(req);

  await query(
    `INSERT INTO final_marksheets (paper_id, final_pdf, finalized_at, approval_status)
     VALUES (?, ?, NOW(), 'PENDING')
     ON DUPLICATE KEY UPDATE final_pdf = VALUES(final_pdf), finalized_at = NOW(), approval_status = 'PENDING',
       approved_by = NULL, approved_at = NULL, hod_comment = NULL`,
    [paper.paper_id, file],
  );
  await notify({
    senderId: req.user.user_id,
    receiverIds: await userIdsByRole('HOD'),
    paperId: paper.paper_id,
    type: 'FINAL_SUBMITTED',
    message: `Final marksheet for ${paperLabel(paper)} is ready for your approval.`,
  });
  res.status(201).json({ message: 'Final marksheet sent to the HOD for approval' });
});

export default router;
