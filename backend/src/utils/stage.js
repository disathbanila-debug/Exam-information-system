// EXAM_PAPER.Status is a derived attribute: it is worked out from the dates recorded at each step.
export const STAGES = [
  { key: 'SCHEDULED', label: 'Scheduled', step: 1 },
  { key: 'AT_AR_OFFICE', label: 'Scripts at AR office', step: 2 },
  { key: 'WITH_LECTURER', label: 'With lecturer for marking', step: 3 },
  { key: 'RETURNED_BY_LECTURER', label: 'Marked scripts returned to AR', step: 4 },
  { key: 'DISPATCHED', label: 'Couriered to 2nd examiner', step: 5 },
  { key: 'WITH_SECOND_EXAMINER', label: 'With 2nd examiner', step: 6 },
  { key: 'SECOND_REPORT_RECEIVED', label: '2nd marker report received', step: 7 },
  { key: 'FORWARDED_TO_HOD', label: 'Documents forwarded to HOD', step: 8 },
  { key: 'FINAL_SUBMITTED', label: 'Final marksheet awaiting approval', step: 9 },
  { key: 'FINAL_REJECTED', label: 'Final marksheet returned for correction', step: 9 },
  { key: 'APPROVED', label: 'Approved by HOD', step: 10 },
  { key: 'SENT_TO_EXAM_BRANCH', label: 'Sent to Exam Branch', step: 11 },
];
export const TOTAL_STEPS = 11;

const BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]));

export function deriveStage(p) {
  let key = 'SCHEDULED';
  if (p.sent_to_exam_branch_at) key = 'SENT_TO_EXAM_BRANCH';
  else if (p.approval_status === 'APPROVED') key = 'APPROVED';
  else if (p.approval_status === 'REJECTED') key = 'FINAL_REJECTED';
  else if (p.approval_status === 'PENDING') key = 'FINAL_SUBMITTED';
  else if (p.sent_to_hod_at) key = 'FORWARDED_TO_HOD';
  else if (p.report_id) key = 'SECOND_REPORT_RECEIVED';
  else if (p.examiner_received_date) key = 'WITH_SECOND_EXAMINER';
  else if (p.dispatched_date) key = 'DISPATCHED';
  else if (p.returned_at) key = 'RETURNED_BY_LECTURER';
  else if (p.collected_at) key = 'WITH_LECTURER';
  else if (p.scripts_received_at) key = 'AT_AR_OFFICE';
  const s = BY_KEY[key];
  return { stage: key, stage_label: s.label, stage_step: s.step, total_steps: TOTAL_STEPS };
}
