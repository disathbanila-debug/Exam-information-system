import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { requireFile, uploadPdf } from '../middleware/upload.js';
import { notify, paperLabel, userIdsByRole } from '../services/notify.js';
import { listPapers, requirePaper, requireStage } from '../services/papers.js';
import * as v from '../utils/validate.js';

// AR Office portal (mounted behind requireRole('AR')).
const router = Router();
const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

router.get('/papers', async (req, res) => {
  res.json({ papers: await listPapers() });
});

/* ---------------- Answer scripts: receive, collection, return ---------------- */

router.post('/papers/:id/scripts-received', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['SCHEDULED'], 'The scripts for this paper are already recorded as received');
  if (!paper.exam_held) throw new HttpError(400, 'This exam has not been held yet');
  if (!paper.lecturer_id) throw new HttpError(400, 'Ask the HOD to assign a lecturer to this subject first');
  const count = v.int(req.body?.no_of_scripts, 'Number of scripts', { min: 1, max: 5000 });
  await query('UPDATE exam_papers SET scripts_received_at = NOW(), no_of_scripts = ? WHERE paper_id = ?', [
    count,
    paper.paper_id,
  ]);
  await notify({
    senderId: req.user.user_id,
    receiverIds: [paper.lecturer_id],
    paperId: paper.paper_id,
    type: 'SCRIPTS_READY',
    message: `The answer scripts for ${paperLabel(paper)} (${count} scripts) have been received by the AR office. Please collect them.`,
  });
  res.json({ message: `Scripts recorded and ${paper.lecturer_name} notified to collect them` });
});

router.post('/papers/:id/collection', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['AT_AR_OFFICE'], 'These scripts are not waiting for collection');
  const collectedBy = v.text(req.body?.collected_by_name, 'Collected by', { max: 120 });
  const collectedAt = v.dateTime(req.body?.collected_at, 'Collected date and time');
  if (collectedAt.slice(0, 10) < paper.scripts_received_at.slice(0, 10)) {
    throw new HttpError(400, 'Collection cannot be before the scripts were received');
  }
  await query(
    `INSERT INTO script_collections (paper_id, lecturer_id, collected_by_name, collected_at, recorded_by)
     VALUES (?, ?, ?, ?, ?)`,
    [paper.paper_id, paper.lecturer_id, collectedBy, collectedAt, req.user.user_id],
  );
  const [sc] = await query('SELECT due_date FROM script_collections WHERE paper_id = ?', [paper.paper_id]);
  await notify({
    senderId: req.user.user_id,
    receiverIds: [paper.lecturer_id],
    paperId: paper.paper_id,
    type: 'SCRIPTS_COLLECTED',
    message: `Collection of the ${paper.subject_code} answer scripts was recorded. Please return the marked scripts by ${fmt(sc.due_date)} (3 months).`,
  });
  res.json({ message: `Collection recorded. Return due by ${fmt(sc.due_date)}` });
});

router.post('/papers/:id/return', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['WITH_LECTURER'], 'These scripts are not with the lecturer');
  const returnedAt = v.date(req.body?.returned_at, 'Returned date');
  if (returnedAt < paper.collected_at.slice(0, 10)) throw new HttpError(400, 'Return date cannot be before collection');
  if (returnedAt > v.todayStr()) throw new HttpError(400, 'Return date cannot be in the future');
  await query('UPDATE script_collections SET returned_at = ? WHERE paper_id = ?', [returnedAt, paper.paper_id]);
  res.json({
    message: paper.latest_version
      ? 'Return of marked scripts recorded'
      : 'Return recorded. Note: the lecturer has not uploaded the marking report yet',
  });
});

/* ---------------- Second marking ---------------- */

router.post('/papers/:id/dispatch', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['RETURNED_BY_LECTURER'], 'Only scripts returned by the lecturer can be couriered');
  if (!paper.second_examiner_id) throw new HttpError(400, 'The lecturer has not nominated a second examiner yet');
  const ref = v.text(req.body?.courier_ref, 'Courier reference', { max: 60 });
  const count = v.int(req.body?.no_of_scripts, 'Number of scripts', { min: 1, max: 5000 });
  const dispatched = v.date(req.body?.dispatched_date, 'Dispatched date');
  if (dispatched < paper.returned_at) throw new HttpError(400, 'Dispatch date cannot be before the scripts were returned');
  await query(
    `INSERT INTO courier_dispatches
       (paper_id, second_examiner_id, ar_officer_id, courier_ref, no_of_scripts, dispatched_date, examiner_notified_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [paper.paper_id, paper.second_examiner_id, req.user.user_id, ref, count, dispatched],
  );
  res.json({
    message: `Dispatch recorded. ${paper.examiner_name} was informed that ${count} scripts of ${paper.subject_code} were sent (${paper.examiner_email}).`,
  });
});

router.post('/papers/:id/examiner-received', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['DISPATCHED'], 'These scripts are not on the way to the second examiner');
  const received = v.date(req.body?.examiner_received_date, 'Received date');
  if (received < paper.dispatched_date) throw new HttpError(400, 'Received date cannot be before the dispatch date');
  await query('UPDATE courier_dispatches SET examiner_received_date = ? WHERE paper_id = ?', [received, paper.paper_id]);
  const [cd] = await query('SELECT due_date FROM courier_dispatches WHERE paper_id = ?', [paper.paper_id]);
  res.json({ message: `Receipt confirmed. The second examiner must return them by ${fmt(cd.due_date)} (1 month)` });
});

router.post('/papers/:id/second-report', uploadPdf, async (req, res) => {
  const paper = await requirePaper(req.params.id);
  requireStage(paper, ['WITH_SECOND_EXAMINER'], 'These scripts are not with the second examiner');
  const returned = v.date(req.body.returned_date, 'Date sent back by examiner');
  const arReceived = v.date(req.body.ar_received_date, 'Date received by AR');
  const reportDate = v.date(req.body.report_date, 'Report date');
  if (returned < paper.examiner_received_date) throw new HttpError(400, 'Sent-back date cannot be before the examiner received the scripts');
  if (arReceived < returned) throw new HttpError(400, 'AR received date cannot be before the sent-back date');
  const file = requireFile(req);

  await query('UPDATE courier_dispatches SET returned_date = ?, ar_received_date = ? WHERE paper_id = ?', [
    returned,
    arReceived,
    paper.paper_id,
  ]);
  await query(
    `INSERT INTO second_marker_reports (paper_id, second_examiner_id, report_pdf, report_date, uploaded_by)
     VALUES (?, ?, ?, ?, ?)`,
    [paper.paper_id, paper.second_examiner_id, file, reportDate, req.user.user_id],
  );
  await notify({
    senderId: req.user.user_id,
    receiverIds: [paper.lecturer_id],
    paperId: paper.paper_id,
    type: 'SECOND_REPORT_ARRIVED',
    message: `The second marker report for ${paperLabel(paper)} has arrived. Review it, correct your detail marksheet if needed and submit the final marksheet.`,
  });
  res.status(201).json({ message: 'Second marker report saved and the lecturer notified' });
});

router.post('/papers/:id/forward-to-hod', async (req, res) => {
  const paper = await requirePaper(req.params.id);
  if (!paper.report_id) throw new HttpError(400, 'The second marker report has not been received yet');
  if (paper.sent_to_hod_at) throw new HttpError(400, 'These documents were already forwarded to the HOD');
  if (!paper.latest_version) throw new HttpError(400, 'The lecturer has not submitted a detail marksheet yet');
  await query('UPDATE second_marker_reports SET sent_to_hod_at = NOW() WHERE paper_id = ?', [paper.paper_id]);
  await notify({
    senderId: req.user.user_id,
    receiverIds: await userIdsByRole('HOD'),
    paperId: paper.paper_id,
    type: 'DOCUMENTS_FORWARDED',
    message: `Detail marksheet (version ${paper.latest_version}) and second marker report for ${paperLabel(paper)} forwarded to you.`,
  });
  res.json({ message: 'Detail marksheet and second marker report forwarded to the HOD' });
});

export default router;
