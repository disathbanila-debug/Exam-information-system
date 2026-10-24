import { query } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { deriveStage } from '../utils/stage.js';

const fullName = (a) => `NULLIF(CONCAT_WS(' ', ${a}.title, ${a}.initials, ${a}.surname), '')`;

// One row per exam paper with everything needed to show its progress through the process.
const PAPER_SELECT = `
SELECT p.paper_id, p.exam_id, e.exam_name, e.academic_year,
  p.subject_code, s.subject_name, s.year_of_study, s.semester, s.credits,
  s.lecturer_id, ${fullName('lu')} AS lecturer_name, lu.email AS lecturer_email,
  p.exam_date, p.start_time, p.end_time, p.venue, p.no_of_scripts, p.scripts_received_at,
  p.second_examiner_id, p.appointed_at, se.examiner_type,
  CASE WHEN se.examiner_type = 'INTERNAL' THEN ${fullName('iu')}
       WHEN se.examiner_type = 'EXTERNAL' THEN CONCAT_WS(' ', ee.title, ee.name_with_initials) END AS examiner_name,
  CASE WHEN se.examiner_type = 'INTERNAL' THEN iu.designation ELSE ee.designation END AS examiner_designation,
  CASE WHEN se.examiner_type = 'INTERNAL' THEN CONCAT(idp.dept_name, ', ', ifa.faculty_name)
       WHEN se.examiner_type = 'EXTERNAL' THEN CONCAT(ee.department, ', ', ee.university) END AS examiner_affiliation,
  COALESCE(iu.email, ee.email) AS examiner_email,
  ee.address AS examiner_address, ee.contact_no AS examiner_contact,
  sc.collected_by_name, sc.collected_at, sc.due_date AS collection_due_date, sc.returned_at,
  ${fullName('cu')} AS collecting_lecturer,
  cd.courier_ref, cd.no_of_scripts AS dispatched_scripts, cd.dispatched_date, cd.examiner_notified_at,
  cd.examiner_received_date, cd.due_date AS examiner_due_date,
  cd.returned_date AS examiner_returned_date, cd.ar_received_date,
  smr.report_id, smr.report_pdf, smr.report_date, smr.sent_to_hod_at,
  dm.version_no AS latest_version, dm.marksheet_pdf AS latest_marksheet_pdf,
  dm.paper_mark_pct, dm.ca_mark_pct, dm.submitted_at AS marksheet_submitted_at,
  fm.final_id, fm.final_pdf, fm.finalized_at, fm.approval_status, fm.approved_at, fm.hod_comment,
  fm.sent_to_exam_branch_at,
  (sc.collected_at IS NOT NULL AND sc.returned_at IS NULL AND CURDATE() > sc.due_date) AS lecturer_overdue,
  (cd.examiner_received_date IS NOT NULL AND cd.returned_date IS NULL AND CURDATE() > cd.due_date) AS examiner_overdue,
  DATEDIFF(sc.due_date, CURDATE()) AS lecturer_days_left,
  DATEDIFF(cd.due_date, CURDATE()) AS examiner_days_left,
  (p.exam_date <= CURDATE()) AS exam_held
FROM exam_papers p
JOIN examinations e ON e.exam_id = p.exam_id
JOIN subjects s ON s.subject_code = p.subject_code
LEFT JOIN users lu ON lu.user_id = s.lecturer_id
LEFT JOIN second_examiners se ON se.examiner_id = p.second_examiner_id
LEFT JOIN users iu ON iu.user_id = se.lecturer_id
LEFT JOIN departments idp ON idp.dept_id = iu.dept_id
LEFT JOIN faculties ifa ON ifa.faculty_id = idp.faculty_id
LEFT JOIN external_examiners ee ON ee.ext_id = se.ext_id
LEFT JOIN script_collections sc ON sc.paper_id = p.paper_id
LEFT JOIN users cu ON cu.user_id = sc.lecturer_id
LEFT JOIN courier_dispatches cd ON cd.paper_id = p.paper_id
LEFT JOIN second_marker_reports smr ON smr.paper_id = p.paper_id
LEFT JOIN detail_marksheets dm ON dm.paper_id = p.paper_id
  AND dm.version_no = (SELECT MAX(x.version_no) FROM detail_marksheets x WHERE x.paper_id = p.paper_id)
LEFT JOIN final_marksheets fm ON fm.paper_id = p.paper_id`;

function shape(row) {
  return {
    ...row,
    lecturer_overdue: !!row.lecturer_overdue,
    examiner_overdue: !!row.examiner_overdue,
    exam_held: !!row.exam_held,
    ...deriveStage(row),
  };
}

export async function listPapers(where = '', params = []) {
  const rows = await query(
    `${PAPER_SELECT} ${where ? `WHERE ${where}` : ''} ORDER BY e.start_date DESC, p.exam_date, p.start_time, p.subject_code`,
    params,
  );
  return rows.map(shape);
}

export async function getPaper(paperId) {
  const [row] = await query(`${PAPER_SELECT} WHERE p.paper_id = ?`, [paperId]);
  return row ? shape(row) : null;
}

export async function requirePaper(paperId) {
  const paper = await getPaper(Number(paperId));
  if (!paper) throw new HttpError(404, 'Exam paper not found');
  return paper;
}

export async function requireOwnPaper(paperId, lecturerId) {
  const paper = await requirePaper(paperId);
  if (paper.lecturer_id !== lecturerId) throw new HttpError(403, 'This exam paper is not assigned to you');
  return paper;
}

export function getMarksheets(paperId) {
  return query(
    `SELECT version_no, marksheet_pdf, paper_mark_pct, ca_mark_pct, remarks, submitted_at
     FROM detail_marksheets WHERE paper_id = ? ORDER BY version_no DESC`,
    [paperId],
  );
}

/** Throws unless the paper is at one of the allowed stages. */
export function requireStage(paper, allowed, message) {
  if (!allowed.includes(paper.stage)) throw new HttpError(400, message);
}
