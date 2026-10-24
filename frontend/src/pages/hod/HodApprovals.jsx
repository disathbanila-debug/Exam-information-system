import { useState } from 'react';
import { api } from '../../api.js';
import PaperDetailModal from '../../components/PaperDetail.jsx';
import { EmptyState, ErrorBox, Field, FormModal, Loader, PageHeader, PdfButton, StageBadge } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime, paperTitle } from '../../utils/format.js';
import { useApi } from '../../utils/useApi.js';

function DecisionModal({ paper, mode, onClose }) {
  const [comment, setComment] = useState('');
  const approve = mode === 'approve';
  return (
    <FormModal
      title={`${approve ? 'Approve' : 'Return'} final marksheet – ${paper.subject_code}`}
      submitLabel={approve ? 'Approve' : 'Return to lecturer'}
      danger={!approve}
      onClose={onClose}
      onSubmit={async () => (await api(`/hod/papers/${paper.paper_id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: { comment } })).message}
    >
      <p className="muted">
        {paperTitle(paper)} · {paper.lecturer_name}
      </p>
      <Field label={approve ? 'Comment (optional)' : 'What needs to be corrected?'} full>
        <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} required={!approve} />
      </Field>
    </FormModal>
  );
}

function DocumentLinks({ p }) {
  return (
    <div className="doc-links">
      <PdfButton file={p.latest_marksheet_pdf}>Detail marksheet v{p.latest_version}</PdfButton>
      <PdfButton file={p.report_pdf}>2nd marker report</PdfButton>
      <PdfButton file={p.final_pdf}>Final marksheet</PdfButton>
    </div>
  );
}

function SendModal({ paper, onClose }) {
  return (
    <FormModal
      title="Send to Exam Information Branch"
      submitLabel="Send"
      onClose={onClose}
      onSubmit={async () => (await api(`/hod/papers/${paper.paper_id}/send-to-branch`, { method: 'POST' })).message}
    >
      <p>
        Send the approved final marksheet for <strong>{paperTitle(paper)}</strong> to the Exam Information Branch? The lecturer
        and the AR office will be notified.
      </p>
    </FormModal>
  );
}

export default function HodApprovals() {
  const { data, loading, error, reload } = useApi('/hod/papers');
  const [decision, setDecision] = useState(null);
  const [sending, setSending] = useState(null);
  const [view, setView] = useState(null);

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const papers = data.papers;
  const pending = papers.filter((p) => p.stage === 'FINAL_SUBMITTED');
  const approved = papers.filter((p) => p.stage === 'APPROVED');
  const forwarded = papers.filter((p) => ['FORWARDED_TO_HOD', 'FINAL_REJECTED'].includes(p.stage));
  const done = papers.filter((p) => p.stage === 'SENT_TO_EXAM_BRANCH');

  return (
    <>
      <PageHeader title="Final approvals" subtitle="Review final marksheets, approve them and send them to the Exam Information Branch" />

      <section className="section">
        <h2 className="section-title">
          Awaiting your approval <span className="count-pill">{pending.length}</span>
        </h2>
        {pending.length ? (
          <div className="approval-grid">
            {pending.map((p) => (
              <div key={p.paper_id} className="card approval-card">
                <div className="approval-head">
                  <div>
                    <strong>{paperTitle(p)}</strong>
                    <div className="muted small">
                      {p.exam_name} · {p.lecturer_name}
                    </div>
                  </div>
                  <StageBadge paper={p} />
                </div>
                <dl className="mini-grid">
                  <dt>Submitted</dt>
                  <dd>{fmtDateTime(p.finalized_at)}</dd>
                  <dt>Marks split</dt>
                  <dd>
                    Paper {Number(p.paper_mark_pct)}% / CA {Number(p.ca_mark_pct)}%
                  </dd>
                  <dt>2nd examiner</dt>
                  <dd>{p.examiner_name}</dd>
                  <dt>Report forwarded</dt>
                  <dd>{p.sent_to_hod_at ? fmtDateTime(p.sent_to_hod_at) : 'Not yet forwarded by AR'}</dd>
                </dl>
                <DocumentLinks p={p} />
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setView(p.paper_id)}>
                    Full timeline
                  </button>
                  <button className="btn btn-outline danger-text" onClick={() => setDecision({ paper: p, mode: 'reject' })}>
                    Return for correction
                  </button>
                  <button className="btn btn-primary" onClick={() => setDecision({ paper: p, mode: 'approve' })}>
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState title="No final marksheets are waiting for approval" />
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">
          Approved – send to Exam Branch <span className="count-pill">{approved.length}</span>
        </h2>
        <div className="card">
          {approved.length ? (
            <table className="table">
              <tbody>
                {approved.map((p) => (
                  <tr key={p.paper_id}>
                    <td>
                      <strong>{paperTitle(p)}</strong>
                      <div className="muted small">{p.lecturer_name}</div>
                    </td>
                    <td>Approved {fmtDateTime(p.approved_at)}</td>
                    <td>
                      <PdfButton file={p.final_pdf}>Final marksheet</PdfButton>
                    </td>
                    <td className="right">
                      <button className="btn btn-primary btn-sm" onClick={() => setSending(p)}>
                        Send to Exam Branch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Nothing to send" />
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          Documents forwarded by the AR office <span className="count-pill">{forwarded.length}</span>
        </h2>
        <div className="card">
          {forwarded.length ? (
            <table className="table">
              <tbody>
                {forwarded.map((p) => (
                  <tr key={p.paper_id}>
                    <td>
                      <strong>{paperTitle(p)}</strong>
                      <div className="muted small">{p.lecturer_name}</div>
                    </td>
                    <td>
                      <StageBadge paper={p} />
                      {p.hod_comment && <div className="muted small">Your note: “{p.hod_comment}”</div>}
                    </td>
                    <td>
                      <DocumentLinks p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No forwarded documents waiting for a final marksheet" />
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          Sent to Exam Information Branch <span className="count-pill">{done.length}</span>
        </h2>
        <div className="card">
          {done.length ? (
            <table className="table">
              <tbody>
                {done.map((p) => (
                  <tr key={p.paper_id}>
                    <td>
                      <strong>{paperTitle(p)}</strong>
                    </td>
                    <td>Sent {fmtDate(p.sent_to_exam_branch_at)}</td>
                    <td className="right">
                      <PdfButton file={p.final_pdf}>Final marksheet</PdfButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Nothing sent yet" />
          )}
        </div>
      </section>

      {decision && (
        <DecisionModal
          {...decision}
          onClose={(saved) => {
            setDecision(null);
            if (saved) reload();
          }}
        />
      )}
      {sending && (
        <SendModal
          paper={sending}
          onClose={(saved) => {
            setSending(null);
            if (saved) reload();
          }}
        />
      )}
      {view && <PaperDetailModal paperId={view} onClose={() => setView(null)} />}
    </>
  );
}
