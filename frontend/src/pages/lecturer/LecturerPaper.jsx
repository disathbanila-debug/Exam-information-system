import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Documents, Timeline } from '../../components/PaperDetail.jsx';
import { DueTag, ErrorBox, Field, FormModal, Loader, PageHeader, PdfButton, ProgressBar, StageBadge, Tabs } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime, fmtTime, paperTitle } from '../../utils/format.js';
import { lecturerNextAction } from '../../utils/stages.js';
import { useApi } from '../../utils/useApi.js';

const CAN_UPLOAD_MARKSHEET = ['WITH_LECTURER', 'RETURNED_BY_LECTURER', 'DISPATCHED', 'WITH_SECOND_EXAMINER', 'SECOND_REPORT_RECEIVED', 'FORWARDED_TO_HOD', 'FINAL_REJECTED'];
const CAN_SUBMIT_FINAL = ['SECOND_REPORT_RECEIVED', 'FORWARDED_TO_HOD', 'FINAL_REJECTED'];

function ExaminerModal({ paper, onClose }) {
  const { data } = useApi('/lecturer/examiner-options');
  const [tab, setTab] = useState('INTERNAL');
  const [lecturerId, setLecturerId] = useState('');
  const [extId, setExtId] = useState('');
  const [ext, setExt] = useState({ title: 'Dr.', designation: '', name_with_initials: '', university: '', department: '', address: '', email: '', contact_no: '' });
  const setE = (k) => (e) => setExt({ ...ext, [k]: e.target.value });

  async function submit() {
    const body =
      tab === 'INTERNAL'
        ? { examiner_type: 'INTERNAL', lecturer_id: lecturerId }
        : tab === 'EXISTING'
          ? { examiner_type: 'EXTERNAL', ext_id: extId }
          : { examiner_type: 'EXTERNAL', external: ext };
    return (await api(`/lecturer/papers/${paper.paper_id}/second-examiner`, { method: 'POST', body })).message;
  }

  return (
    <FormModal title={`Second examiner for ${paper.subject_code}`} submitLabel="Nominate" onClose={onClose} onSubmit={submit} wide>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'INTERNAL', label: 'Internal lecturer' },
          { key: 'EXISTING', label: 'External (saved)' },
          { key: 'NEW', label: 'New external examiner' },
        ]}
      />
      {tab === 'INTERNAL' && (
        <Field label="Lecturer" full hint="Only lecturers of a higher grade than you are listed. They may be from another department or faculty.">
          <select value={lecturerId} onChange={(e) => setLecturerId(e.target.value)} required>
            <option value="">Choose a lecturer…</option>
            {(data?.internal || []).map((l) => (
              <option key={l.user_id} value={l.user_id}>
                {l.name} – {l.designation} · {l.dept_name}, {l.faculty_name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {tab === 'EXISTING' && (
        <Field label="External examiner" full>
          <select value={extId} onChange={(e) => setExtId(e.target.value)} required>
            <option value="">Choose an examiner…</option>
            {(data?.external || []).map((x) => (
              <option key={x.ext_id} value={x.ext_id}>
                {x.title} {x.name_with_initials} – {x.designation}, {x.university}
              </option>
            ))}
          </select>
        </Field>
      )}
      {tab === 'NEW' && (
        <div className="form-grid three">
          <Field label="Title">
            <select value={ext.title} onChange={setE('title')}>
              {['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Name with initials">
            <input value={ext.name_with_initials} onChange={setE('name_with_initials')} placeholder="T. Ranasinghe" required />
          </Field>
          <Field label="Designation">
            <input value={ext.designation} onChange={setE('designation')} placeholder="Senior Lecturer" required />
          </Field>
          <Field label="University">
            <input value={ext.university} onChange={setE('university')} required />
          </Field>
          <Field label="Department">
            <input value={ext.department} onChange={setE('department')} required />
          </Field>
          <Field label="Contact number">
            <input value={ext.contact_no} onChange={setE('contact_no')} required />
          </Field>
          <Field label="Postal address (for the courier)" full>
            <input value={ext.address} onChange={setE('address')} required />
          </Field>
          <Field label="Email address">
            <input type="email" value={ext.email} onChange={setE('email')} required />
          </Field>
        </div>
      )}
    </FormModal>
  );
}

function MarksheetModal({ paper, onClose }) {
  const [file, setFile] = useState(null);
  const [paperPct, setPaperPct] = useState(paper.paper_mark_pct ? Number(paper.paper_mark_pct) : 70);
  const [remarks, setRemarks] = useState('');
  const next = (paper.latest_version || 0) + 1;

  async function submit() {
    const form = new FormData();
    form.append('file', file);
    form.append('paper_mark_pct', paperPct);
    form.append('ca_mark_pct', 100 - paperPct);
    form.append('remarks', remarks);
    return (await api(`/lecturer/papers/${paper.paper_id}/marksheets`, { method: 'POST', form })).message;
  }

  return (
    <FormModal title={next === 1 ? 'Submit marking report' : `Upload corrected detail marksheet (version ${next})`} submitLabel="Upload" onClose={onClose} onSubmit={submit}>
      <Field label="Detail marksheet (PDF)" full>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files[0])} required />
      </Field>
      <div className="form-grid">
        <Field label="Marks for the paper (%)">
          <input type="number" min={0} max={100} value={paperPct} onChange={(e) => setPaperPct(Number(e.target.value))} required />
        </Field>
        <Field label="Continuous assessment (%)" hint="Paper % + CA % = 100">
          <input type="number" value={100 - paperPct} disabled />
        </Field>
      </div>
      <Field label="Remarks (optional)" full>
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={next > 1 ? 'Corrected after second marker report' : ''} />
      </Field>
    </FormModal>
  );
}

function FinalModal({ paper, onClose }) {
  const [file, setFile] = useState(null);
  async function submit() {
    const form = new FormData();
    form.append('file', file);
    return (await api(`/lecturer/papers/${paper.paper_id}/final`, { method: 'POST', form })).message;
  }
  return (
    <FormModal title="Submit final marksheet to HOD" submitLabel="Finalize and send" onClose={onClose} onSubmit={submit}>
      <p className="muted">
        Upload the final marksheet including the continuous assessment marks. Once sent, the HOD reviews and approves it.
      </p>
      <Field label="Final marksheet (PDF)" full>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files[0])} required />
      </Field>
    </FormModal>
  );
}

function Panel({ title, step, children, action }) {
  return (
    <section className="card panel">
      <div className="panel-head">
        <h3>
          {step && <span className="step-no">{step}</span>}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function LecturerPaper() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/papers/${id}`);
  const [modal, setModal] = useState(null);

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const p = data.paper;
  const next = lecturerNextAction(p);
  const close = (saved) => {
    setModal(null);
    if (saved) reload();
  };

  return (
    <>
      <PageHeader
        title={paperTitle(p)}
        subtitle={`${p.exam_name} · ${fmtDate(p.exam_date)}, ${fmtTime(p.start_time)} – ${fmtTime(p.end_time)} · ${p.venue}`}
        actions={
          <Link to="/lecturer" className="btn btn-ghost">
            ← All papers
          </Link>
        }
      />
      <div className="card status-strip">
        <div className="status-row">
          <StageBadge paper={p} />
          <span className="muted small">
            Step {p.stage_step} of {p.total_steps}
          </span>
          {next && <span className="next-action">Next: {next}</span>}
        </div>
        <ProgressBar step={p.stage_step} total={p.total_steps} />
      </div>

      <div className="two-col">
        <div className="stack">
          <Panel
            step="1"
            title="Second examiner"
            action={
              !p.dispatched_date && (
                <button className="btn btn-sm btn-primary" onClick={() => setModal('examiner')}>
                  {p.second_examiner_id ? 'Change' : 'Nominate'}
                </button>
              )
            }
          >
            {p.examiner_name ? (
              <dl className="mini-grid">
                <dt>Name</dt>
                <dd>
                  {p.examiner_name} <span className="badge tone-gray">{p.examiner_type === 'INTERNAL' ? 'Internal' : 'External'}</span>
                </dd>
                <dt>Designation</dt>
                <dd>{p.examiner_designation}</dd>
                <dt>Affiliation</dt>
                <dd>{p.examiner_affiliation}</dd>
                <dt>Email</dt>
                <dd>{p.examiner_email}</dd>
                <dt>Nominated on</dt>
                <dd>{fmtDate(p.appointed_at)}</dd>
              </dl>
            ) : (
              <p className="muted">
                Not nominated yet. Choose an internal lecturer of a higher grade, or an external examiner.
              </p>
            )}
          </Panel>

          <Panel step="2" title="Answer scripts">
            <dl className="mini-grid">
              <dt>At AR office</dt>
              <dd>{p.scripts_received_at ? `${fmtDateTime(p.scripts_received_at)} · ${p.no_of_scripts} scripts` : 'Not yet'}</dd>
              <dt>Collected</dt>
              <dd>{p.collected_at ? `${fmtDateTime(p.collected_at)} by ${p.collected_by_name}` : 'Not yet'}</dd>
              <dt>Return by</dt>
              <dd>
                {p.collection_due_date ? fmtDate(p.collection_due_date) : '—'}{' '}
                <DueTag days={p.lecturer_days_left} done={!!p.returned_at || !p.collected_at} />
              </dd>
              <dt>Returned</dt>
              <dd>{p.returned_at ? fmtDate(p.returned_at) : 'Not yet'}</dd>
            </dl>
            <p className="muted small">The AR office records when you collect and return the scripts.</p>
          </Panel>

          <Panel
            step="3"
            title="Marking report / detail marksheet"
            action={
              CAN_UPLOAD_MARKSHEET.includes(p.stage) && (
                <button className="btn btn-sm btn-primary" onClick={() => setModal('marksheet')}>
                  {p.latest_version ? 'Upload corrected version' : 'Upload marking report'}
                </button>
              )
            }
          >
            {data.marksheets.length ? (
              <Documents paper={{}} marksheets={data.marksheets} />
            ) : (
              <p className="muted">
                {p.collected_at ? 'Upload the detail marksheet (PDF) with the paper % and CA %.' : 'Available after you collect the scripts.'}
              </p>
            )}
          </Panel>

          <Panel step="4" title="Second marker report">
            {p.report_pdf ? (
              <div className="row-between">
                <span>
                  Received by AR on {fmtDate(p.ar_received_date)} · report dated {fmtDate(p.report_date)}
                </span>
                <PdfButton file={p.report_pdf}>Open report</PdfButton>
              </div>
            ) : (
              <p className="muted">
                {p.dispatched_date ? `With ${p.examiner_name} since ${fmtDate(p.examiner_received_date || p.dispatched_date)}.` : 'Not sent to the second examiner yet.'}
              </p>
            )}
          </Panel>

          <Panel
            step="5"
            title="Final marksheet"
            action={
              CAN_SUBMIT_FINAL.includes(p.stage) &&
              p.latest_version && (
                <button className="btn btn-sm btn-primary" onClick={() => setModal('final')}>
                  {p.final_id ? 'Resubmit final' : 'Submit final marksheet'}
                </button>
              )
            }
          >
            {p.final_pdf ? (
              <>
                <div className="row-between">
                  <span>
                    Submitted {fmtDateTime(p.finalized_at)} ·{' '}
                    <span className={`badge tone-${{ PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' }[p.approval_status]}`}>
                      {p.approval_status.toLowerCase()}
                    </span>
                    {p.sent_to_exam_branch_at && <span className="badge tone-darkgreen">sent to Exam Branch</span>}
                  </span>
                  <PdfButton file={p.final_pdf} />
                </div>
                {p.hod_comment && <p className="hod-note">HOD: “{p.hod_comment}”</p>}
              </>
            ) : (
              <p className="muted">Available after the second marker report arrives. Include the continuous assessment marks.</p>
            )}
          </Panel>
        </div>

        <section className="card">
          <h3>Process timeline</h3>
          <Timeline paper={p} />
        </section>
      </div>

      {modal === 'examiner' && <ExaminerModal paper={p} onClose={close} />}
      {modal === 'marksheet' && <MarksheetModal paper={p} onClose={close} />}
      {modal === 'final' && <FinalModal paper={p} onClose={close} />}
    </>
  );
}
