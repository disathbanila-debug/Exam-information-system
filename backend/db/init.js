// Creates all tables (dropping existing ones) and loads demo data.
// Usage: npm run db:init
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { dbConfig, pool } from '../src/db.js';
import { UPLOAD_DIR } from '../src/middleware/upload.js';
import { gradeLabel } from '../src/utils/grades.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Demo password for every seeded account (local development only).
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Exam@1234';

// Dates relative to today so the demo data always shows overdue and pending items.
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const at = (offset, time) => `${day(offset)} ${time}`;

function makePdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const body = [
    `BT /F1 18 Tf 60 780 Td (${esc(title)}) Tj ET`,
    'BT /F1 11 Tf 60 745 Td 18 TL',
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function savePdf(name, title, lines) {
  const file = `seed-${name}.pdf`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), makePdf(title, lines));
  return file;
}

async function main() {
  const { database, ...server } = dbConfig;
  const admin = await mysql.createConnection(server);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  const q = async (sql, params = []) => (await conn.query(sql, params))[0];
  const id = async (sql, params) => (await q(sql, params)).insertId;

  console.log(`Creating tables in "${dbConfig.database}" ...`);
  await conn.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

  /* ---------- faculties, departments ---------- */
  const fas = await id('INSERT INTO faculties (faculty_name) VALUES (?)', ['Faculty of Applied Sciences']);
  const fot = await id('INSERT INTO faculties (faculty_name) VALUES (?)', ['Faculty of Technology']);
  const dept = (name, f) => id('INSERT INTO departments (dept_name, faculty_id) VALUES (?, ?)', [name, f]);
  const computing = await dept('Department of Computing', fas);
  const physical = await dept('Department of Physical Sciences', fas);
  await dept('Department of Biological Sciences', fas);
  const ict = await dept('Department of Information and Communication Technology', fot);

  /* ---------- users (HOD, AR officer, lecturers) ---------- */
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const user = async (title, initials, surname, role, grade, deptId, email, contacts, designation) => {
    const userId = await id(
      `INSERT INTO users (title, initials, surname, designation, email, password_hash, role, grade_level, dept_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, initials, surname, designation ?? gradeLabel(grade), email, hash, role, grade, deptId],
    );
    for (const c of contacts) await q('INSERT INTO user_contact_numbers (user_id, contact_no) VALUES (?, ?)', [userId, c]);
    return userId;
  };
  const hod = await user('Dr.', 'A.B.', 'Perera', 'HOD', 4, computing, 'hod@exam.test', ['0712345678', '0252266001']);
  const ar = await user('Mrs.', 'K.M.', 'Silva', 'AR', null, null, 'ar@exam.test', ['0252266100'], 'Assistant Registrar (Examinations)');
  const jaya = await user('Mr.', 'S.', 'Jayasinghe', 'LECTURER', 2, computing, 'lecturer1@exam.test', ['0771234567']);
  const fernando = await user('Ms.', 'N.', 'Fernando', 'LECTURER', 1, computing, 'lecturer2@exam.test', ['0761234567']);
  const wick = await user('Dr.', 'R.', 'Wickramasinghe', 'LECTURER', 3, computing, 'lecturer3@exam.test', ['0701234567', '0252266010']);
  const guna = await user('Prof.', 'M.', 'Gunasekara', 'LECTURER', 5, physical, 'gunasekara@exam.test', ['0711111111']);
  await user('Dr.', 'P.', 'Bandara', 'LECTURER', 4, ict, 'bandara@exam.test', ['0722222222']);

  /* ---------- second examiners ---------- */
  const ext = (row) =>
    id(
      `INSERT INTO external_examiners (title, designation, name_with_initials, university, department, address, email, contact_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      row,
    );
  const ext1 = await ext(['Dr.', 'Senior Lecturer', 'T. Ranasinghe', 'University of Colombo', 'Department of Computer Science',
    'Department of Computer Science, University of Colombo, Colombo 03', 't.ranasinghe@example.com', '0112581245']);
  await ext(['Prof.', 'Professor', 'L. Dissanayake', 'University of Moratuwa', 'Department of Computer Science and Engineering',
    'Department of Computer Science and Engineering, University of Moratuwa, Katubedda', 'l.dissanayake@example.com', '0112650301']);
  const seExt1 = await id("INSERT INTO second_examiners (examiner_type, ext_id) VALUES ('EXTERNAL', ?)", [ext1]);
  const seWick = await id("INSERT INTO second_examiners (examiner_type, lecturer_id) VALUES ('INTERNAL', ?)", [wick]);
  const seGuna = await id("INSERT INTO second_examiners (examiner_type, lecturer_id) VALUES ('INTERNAL', ?)", [guna]);

  /* ---------- subjects ---------- */
  const subjects = [
    ['ICT1402', 'Data Structures and Algorithms', 3, 1, 2, fernando],
    ['ICT1403', 'Web Technologies', 3, 1, 2, wick],
    ['ICT1407', 'Database Systems', 3, 1, 2, jaya],
    ['ICT2401', 'Operating Systems', 3, 2, 1, jaya],
    ['ICT2402', 'Software Engineering', 3, 2, 1, fernando],
    ['ICT2403', 'Computer Networks', 2, 2, 1, wick],
    ['ICT2405', 'Mobile Application Development', 3, 2, 2, fernando],
    ['ICT2406', 'Data Communication', 2, 2, 2, jaya],
  ];
  for (const [code, name, credits, year, sem, lec] of subjects) {
    await q(
      'INSERT INTO subjects (subject_code, subject_name, credits, year_of_study, semester, dept_id, lecturer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, name, credits, year, sem, computing, lec],
    );
  }

  /* ---------- examinations & timetables ---------- */
  const exam = (name, year, sem, start, end) =>
    id(
      `INSERT INTO examinations (exam_name, academic_year, year_of_study, semester, start_date, end_date, prepared_by)
       VALUES (?, '2025/2026', ?, ?, ?, ?, ?)`,
      [name, year, sem, start, end, hod],
    );
  const examA = await exam('Year 1 - Semester 2 Examination', 1, 2, day(-150), day(-122));
  const examB = await exam('Year 2 - Semester 1 Examination', 2, 1, day(-35), day(-6));
  const examC = await exam('Year 2 - Semester 2 Examination', 2, 2, day(30), day(58));

  const paper = (examId, code, offset, start, end, venue) =>
    id(
      'INSERT INTO exam_papers (exam_id, subject_code, exam_date, start_time, end_time, venue) VALUES (?, ?, ?, ?, ?, ?)',
      [examId, code, day(offset), start, end, venue],
    );
  const p1 = await paper(examA, 'ICT1407', -148, '09:00', '12:00', 'Main Hall A');
  const p2 = await paper(examA, 'ICT1402', -145, '09:00', '12:00', 'Main Hall A');
  const p3 = await paper(examA, 'ICT1403', -142, '13:30', '16:30', 'Computing Lab 1');
  const p4 = await paper(examB, 'ICT2401', -33, '09:00', '12:00', 'Main Hall B');
  const p5 = await paper(examB, 'ICT2402', -30, '09:00', '12:00', 'Main Hall B');
  await paper(examB, 'ICT2403', -27, '13:30', '15:30', 'Computing Lab 2');
  await paper(examC, 'ICT2405', 32, '09:00', '12:00', 'Main Hall A');
  await paper(examC, 'ICT2406', 35, '09:00', '11:00', 'Main Hall A');

  /* ---------- workflow progress (so every portal has something to show) ---------- */
  const received = (p, when, count) =>
    q('UPDATE exam_papers SET scripts_received_at = ?, no_of_scripts = ? WHERE paper_id = ?', [when, count, p]);
  const appoint = (p, se, when, by) =>
    q('UPDATE exam_papers SET second_examiner_id = ?, appointed_at = ?, appointed_by = ? WHERE paper_id = ?', [se, when, by, p]);
  const collect = (p, lec, name, when) =>
    q('INSERT INTO script_collections (paper_id, lecturer_id, collected_by_name, collected_at, recorded_by) VALUES (?, ?, ?, ?, ?)', [
      p, lec, name, when, ar,
    ]);
  const marksheet = (p, v, file, paperPct, caPct, when, remarks = null) =>
    q(
      'INSERT INTO detail_marksheets (paper_id, version_no, marksheet_pdf, paper_mark_pct, ca_mark_pct, remarks, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [p, v, file, paperPct, caPct, remarks, when],
    );

  // ICT1407: collected long ago and never returned -> overdue (3 months)
  await appoint(p1, seExt1, day(-155), jaya);
  await received(p1, at(-146, '10:00:00'), 52);
  await collect(p1, jaya, 'Mr. S. Jayasinghe', at(-144, '09:30:00'));

  // ICT1402: with the internal 2nd examiner for more than a month -> overdue (1 month)
  await appoint(p2, seWick, day(-150), fernando);
  await received(p2, at(-143, '11:00:00'), 48);
  await collect(p2, fernando, 'Ms. N. Fernando', at(-141, '14:15:00'));
  await marksheet(p2, 1, savePdf('ICT1402-v1', 'ICT1402 Detail Marksheet - Version 1',
    ['Data Structures and Algorithms', 'Paper 70% / CA 30%', 'Sample document created by the seed script.']), 70, 30, at(-82, '10:00:00'));
  await q('UPDATE script_collections SET returned_at = ? WHERE paper_id = ?', [day(-80), p2]);
  await q(
    `INSERT INTO courier_dispatches (paper_id, second_examiner_id, ar_officer_id, courier_ref, no_of_scripts,
       dispatched_date, examiner_notified_at, examiner_received_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p2, seWick, ar, 'SLP-CR-10452', 48, day(-78), at(-78, '15:00:00'), day(-74)],
  );

  // ICT1403: second marking finished, final marksheet waiting for HOD approval
  await appoint(p3, seGuna, day(-152), wick);
  await received(p3, at(-140, '10:30:00'), 61);
  await collect(p3, wick, 'Dr. R. Wickramasinghe', at(-139, '09:00:00'));
  await marksheet(p3, 1, savePdf('ICT1403-v1', 'ICT1403 Detail Marksheet - Version 1',
    ['Web Technologies', 'Paper 60% / CA 40%', 'Sample document created by the seed script.']), 60, 40, at(-100, '11:00:00'));
  await q('UPDATE script_collections SET returned_at = ? WHERE paper_id = ?', [day(-98), p3]);
  await q(
    `INSERT INTO courier_dispatches (paper_id, second_examiner_id, ar_officer_id, courier_ref, no_of_scripts,
       dispatched_date, examiner_notified_at, examiner_received_date, returned_date, ar_received_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p3, seGuna, ar, 'SLP-CR-10388', 61, day(-96), at(-96, '14:00:00'), day(-93), day(-70), day(-67)],
  );
  await q(
    `INSERT INTO second_marker_reports (paper_id, second_examiner_id, report_pdf, report_date, uploaded_by, sent_to_hod_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p3, seGuna, savePdf('ICT1403-second-marker', 'ICT1403 Second Marker Report',
      ['Second examiner: Prof. M. Gunasekara', 'Marking is consistent. Minor corrections suggested for Q3 and Q5.',
        'Sample document created by the seed script.']), day(-71), ar, at(-65, '11:00:00')],
  );
  await marksheet(p3, 2, savePdf('ICT1403-v2', 'ICT1403 Detail Marksheet - Version 2',
    ['Web Technologies', 'Corrected after the second marker report', 'Paper 60% / CA 40%']), 60, 40, at(-60, '09:30:00'),
  'Corrected after second marker report');
  await q("INSERT INTO final_marksheets (paper_id, final_pdf, finalized_at, approval_status) VALUES (?, ?, ?, 'PENDING')", [
    p3,
    savePdf('ICT1403-final', 'ICT1403 Final Marksheet', ['Web Technologies', 'Final marks including continuous assessment (CA).',
      'Sample document created by the seed script.']),
    at(-55, '16:00:00'),
  ]);

  // ICT2401: scripts at the AR office, waiting for collection
  await received(p4, at(-30, '10:00:00'), 75);
  // ICT2402: with the lecturer, 2nd examiner not nominated yet
  await received(p5, at(-28, '09:45:00'), 70);
  await collect(p5, fernando, 'Ms. N. Fernando', at(-26, '11:20:00'));
  // ICT2403: exam held, scripts not recorded yet; ICT2405/ICT2406: upcoming

  /* ---------- notifications ---------- */
  const note = (sender, receiver, p, type, message, when, read = 1) =>
    q(
      'INSERT INTO notifications (sender_id, receiver_id, paper_id, notif_type, message, sent_at, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sender, receiver, p, type, message, when, read],
    );
  const ready = (code, name, n) =>
    `The answer scripts for ${code} - ${name} (${n} scripts) have been received by the AR office. Please collect them.`;
  await note(ar, jaya, p1, 'SCRIPTS_READY', ready('ICT1407', 'Database Systems', 52), at(-146, '10:05:00'));
  await note(ar, fernando, p2, 'SCRIPTS_READY', ready('ICT1402', 'Data Structures and Algorithms', 48), at(-143, '11:05:00'));
  await note(ar, wick, p3, 'SCRIPTS_READY', ready('ICT1403', 'Web Technologies', 61), at(-140, '10:35:00'));
  await note(fernando, ar, p2, 'MARKSHEET_SUBMITTED', 'Marking report submitted for ICT1402 - Data Structures and Algorithms. Paper 70% / CA 30%.', at(-82, '10:00:00'));
  await note(ar, wick, p3, 'SECOND_REPORT_ARRIVED', 'The second marker report for ICT1403 - Web Technologies has arrived. Review it, correct your detail marksheet if needed and submit the final marksheet.', at(-67, '12:00:00'));
  await note(ar, hod, p3, 'DOCUMENTS_FORWARDED', 'Detail marksheet (version 1) and second marker report for ICT1403 - Web Technologies forwarded to you.', at(-65, '11:00:00'));
  await note(wick, hod, p3, 'FINAL_SUBMITTED', 'Final marksheet for ICT1403 - Web Technologies is ready for your approval.', at(-55, '16:00:00'), 0);
  await note(ar, jaya, p4, 'SCRIPTS_READY', ready('ICT2401', 'Operating Systems', 75), at(-30, '10:05:00'), 0);
  await note(ar, fernando, p5, 'SCRIPTS_READY', ready('ICT2402', 'Software Engineering', 70), at(-28, '09:50:00'));
  await note(jaya, ar, p1, 'EXAMINER_NOMINATED', 'Dr. T. Ranasinghe was nominated as the second examiner for ICT1407 - Database Systems.', at(-155, '08:30:00'), 0);

  await conn.end();
  await pool.end();
  console.log('Database ready with demo data.');
  console.log(`Demo accounts (password: ${SEED_PASSWORD}): hod@exam.test, ar@exam.test, lecturer1@exam.test, lecturer2@exam.test, lecturer3@exam.test`);
}

main().catch(async (err) => {
  console.error('Database setup failed:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
