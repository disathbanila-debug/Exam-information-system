// Mirrors backend/src/utils/stage.js
export const STAGES = [
  ['SCHEDULED', 'Scheduled', 'gray'],
  ['AT_AR_OFFICE', 'Scripts at AR office', 'blue'],
  ['WITH_LECTURER', 'With lecturer for marking', 'amber'],
  ['RETURNED_BY_LECTURER', 'Marked scripts returned to AR', 'teal'],
  ['DISPATCHED', 'Couriered to 2nd examiner', 'purple'],
  ['WITH_SECOND_EXAMINER', 'With 2nd examiner', 'purple'],
  ['SECOND_REPORT_RECEIVED', '2nd marker report received', 'indigo'],
  ['FORWARDED_TO_HOD', 'Documents forwarded to HOD', 'indigo'],
  ['FINAL_SUBMITTED', 'Final marksheet awaiting approval', 'orange'],
  ['FINAL_REJECTED', 'Final marksheet returned for correction', 'red'],
  ['APPROVED', 'Approved by HOD', 'green'],
  ['SENT_TO_EXAM_BRANCH', 'Sent to Exam Branch', 'darkgreen'],
];

export const STAGE_TONE = Object.fromEntries(STAGES.map(([k, , tone]) => [k, tone]));

/** What the lecturer should do next for a paper (null = nothing). */
export function lecturerNextAction(p) {
  switch (p.stage) {
    case 'SCHEDULED':
      return p.second_examiner_id ? null : 'Nominate a second examiner';
    case 'AT_AR_OFFICE':
      return 'Collect the answer scripts from the AR office';
    case 'WITH_LECTURER':
      if (!p.second_examiner_id) return 'Nominate a second examiner';
      return p.latest_version ? 'Return the marked scripts to the AR office' : 'Mark the scripts and upload the marking report';
    case 'RETURNED_BY_LECTURER':
      return p.second_examiner_id ? null : 'Nominate a second examiner';
    case 'SECOND_REPORT_RECEIVED':
    case 'FORWARDED_TO_HOD':
      return 'Review the 2nd marker report and submit the final marksheet';
    case 'FINAL_REJECTED':
      return 'Correct and resubmit the final marksheet';
    default:
      return null;
  }
}

/** What the AR office should do next for a paper (null = nothing). */
export function arNextAction(p) {
  switch (p.stage) {
    case 'SCHEDULED':
      return p.exam_held ? 'Record scripts received' : null;
    case 'AT_AR_OFFICE':
      return 'Record collection';
    case 'WITH_LECTURER':
      return 'Record return of marked scripts';
    case 'RETURNED_BY_LECTURER':
      return p.second_examiner_id ? 'Courier scripts to 2nd examiner' : null;
    case 'DISPATCHED':
      return 'Record examiner receipt';
    case 'WITH_SECOND_EXAMINER':
      return 'Record return & upload 2nd report';
    case 'SECOND_REPORT_RECEIVED':
      return p.latest_version ? 'Forward documents to HOD' : null;
    default:
      return null;
  }
}
