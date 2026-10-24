import { useApi } from '../utils/useApi.js';
import { fmtDate, fmtDateTime, fmtTime, paperTitle } from '../utils/format.js';
import { DueTag, ErrorBox, Loader, Modal, PdfButton, ProgressBar, StageBadge } from './ui.jsx';

/** Every step of the process for one paper, with the date it happened (or null). */
export function buildTimeline(p) {
  return [
    { label: 'Exam held', date: p.exam_held ? p.exam_date : null, info: `${fmtTime(p.start_time)} – ${fmtTime(p.end_time)}, ${p.venue}` },
    { label: 'Answer scripts received by AR office', date: p.scripts_received_at, time: true, info: p.no_of_scripts && `${p.no_of_scripts} scripts · lecturer notified` },
    {
      label: 'Scripts collected by lecturer',
      date: p.collected_at,
      time: true,
      info: p.collected_at && `Collected by ${p.collected_by_name} · return due ${fmtDate(p.collection_due_date)}`,
      due: !p.returned_at && p.collected_at ? p.lecturer_days_left : null,
    },
    {
      label: 'Marking report submitted',
      date: p.marksheet_submitted_at,
      time: true,
      info: p.latest_version && `Latest: version ${p.latest_version} · Paper ${Number(p.paper_mark_pct)}% / CA ${Number(p.ca_mark_pct)}%`,
    },
    { label: 'Marked scripts returned to AR office', date: p.returned_at },
    { label: 'Second examiner nominated', date: p.appointed_at, info: p.examiner_name && `${p.examiner_name} (${p.examiner_type?.toLowerCase()})` },
    {
      label: 'Couriered to second examiner',
      date: p.dispatched_date,
      info: p.dispatched_date && `Ref ${p.courier_ref} · ${p.dispatched_scripts} scripts · examiner notified`,
    },
    {
      label: 'Received by second examiner',
      date: p.examiner_received_date,
      info: p.examiner_received_date && `Return due ${fmtDate(p.examiner_due_date)}`,
      due: !p.examiner_returned_date && p.examiner_received_date ? p.examiner_days_left : null,
    },
    {
      label: 'Scripts & 2nd marker report received by AR',
      date: p.ar_received_date,
      info: p.ar_received_date && `Sent back by examiner on ${fmtDate(p.examiner_returned_date)}`,
    },
    { label: 'Detail marksheet & report forwarded to HOD', date: p.sent_to_hod_at, time: true },
    { label: 'Final marksheet submitted', date: p.finalized_at, time: true },
    {
      label: p.approval_status === 'REJECTED' ? 'Returned by HOD for correction' : 'Approved by HOD',
      date: p.approval_status && p.approval_status !== 'PENDING' ? p.approved_at : null,
      time: true,
      info: p.hod_comment && `"${p.hod_comment}"`,
      warn: p.approval_status === 'REJECTED',
    },
    { label: 'Sent to Exam Information Branch', date: p.sent_to_exam_branch_at, time: true },
  ];
}

export function Timeline({ paper }) {
  return (
    <ol className="timeline">
      {buildTimeline(paper).map((s) => (
        <li key={s.label} className={`tl-item ${s.date ? (s.warn ? 'warn' : 'done') : ''}`}>
          <span className="tl-dot" />
          <div className="tl-body">
            <div className="tl-label">
              {s.label} <DueTag days={s.due} />
            </div>
            <div className="tl-meta">
              {s.date ? (s.time ? fmtDateTime(s.date) : fmtDate(s.date)) : 'Pending'}
              {s.date && s.info ? ` · ${s.info}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PaperSummary({ paper: p }) {
  return (
    <dl className="info-grid">
      <div>
        <dt>Examination</dt>
        <dd>{p.exam_name}</dd>
      </div>
      <div>
        <dt>Exam date</dt>
        <dd>
          {fmtDate(p.exam_date)}, {fmtTime(p.start_time)} – {fmtTime(p.end_time)}
        </dd>
      </div>
      <div>
        <dt>Venue</dt>
        <dd>{p.venue}</dd>
      </div>
      <div>
        <dt>Lecturer</dt>
        <dd>{p.lecturer_name || 'Not assigned'}</dd>
      </div>
      <div>
        <dt>Answer scripts</dt>
        <dd>{p.no_of_scripts ?? '—'}</dd>
      </div>
      <div>
        <dt>Second examiner</dt>
        <dd>
          {p.examiner_name ? (
            <>
              {p.examiner_name} <span className="muted">({p.examiner_type === 'INTERNAL' ? 'internal' : 'external'})</span>
              <div className="muted small">{p.examiner_affiliation}</div>
            </>
          ) : (
            'Not nominated'
          )}
        </dd>
      </div>
    </dl>
  );
}

export function Documents({ paper, marksheets }) {
  return (
    <table className="table compact">
      <thead>
        <tr>
          <th>Document</th>
          <th>Details</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {marksheets.map((m) => (
          <tr key={m.version_no}>
            <td>Detail marksheet v{m.version_no}</td>
            <td className="muted">
              Paper {Number(m.paper_mark_pct)}% / CA {Number(m.ca_mark_pct)}% · {fmtDateTime(m.submitted_at)}
              {m.remarks ? ` · ${m.remarks}` : ''}
            </td>
            <td className="right">
              <PdfButton file={m.marksheet_pdf} />
            </td>
          </tr>
        ))}
        {paper.report_pdf && (
          <tr>
            <td>Second marker report</td>
            <td className="muted">
              {paper.examiner_name} · {fmtDate(paper.report_date)}
            </td>
            <td className="right">
              <PdfButton file={paper.report_pdf} />
            </td>
          </tr>
        )}
        {paper.final_pdf && (
          <tr>
            <td>Final marksheet</td>
            <td className="muted">
              {paper.approval_status.toLowerCase()} · {fmtDateTime(paper.finalized_at)}
            </td>
            <td className="right">
              <PdfButton file={paper.final_pdf} />
            </td>
          </tr>
        )}
        {!marksheets.length && !paper.report_pdf && !paper.final_pdf && (
          <tr>
            <td colSpan={3} className="muted">
              No documents uploaded yet
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function PaperDetailModal({ paperId, onClose }) {
  const { data, loading, error, reload } = useApi(`/papers/${paperId}`);
  return (
    <Modal title={data ? paperTitle(data.paper) : 'Exam paper'} onClose={onClose} wide>
      {loading && !data && <Loader />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <div className="detail">
          <div className="detail-status">
            <StageBadge paper={data.paper} />
            <span className="muted small">
              Step {data.paper.stage_step} of {data.paper.total_steps}
            </span>
          </div>
          <ProgressBar step={data.paper.stage_step} total={data.paper.total_steps} />
          <PaperSummary paper={data.paper} />
          <div className="detail-cols">
            <section>
              <h3>Process timeline</h3>
              <Timeline paper={data.paper} />
            </section>
            <section>
              <h3>Documents</h3>
              <Documents paper={data.paper} marksheets={data.marksheets} />
            </section>
          </div>
        </div>
      )}
    </Modal>
  );
}
