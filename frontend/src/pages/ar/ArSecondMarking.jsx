import { useState } from 'react';
import { api } from '../../api.js';
import PaperDetailModal from '../../components/PaperDetail.jsx';
import { DueTag, EmptyState, ErrorBox, Field, FormModal, Loader, PageHeader, PdfButton, StageBadge, Tabs } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime, paperTitle, todayISO } from '../../utils/format.js';
import { useApi } from '../../utils/useApi.js';

function ExaminerCard({ p }) {
  return (
    <div className="examiner-card">
      <strong>{p.examiner_name}</strong> <span className="badge tone-gray">{p.examiner_type === 'INTERNAL' ? 'Internal' : 'External'}</span>
      <div>{p.examiner_designation}</div>
      <div className="muted">{p.examiner_affiliation}</div>
      {p.examiner_address && <div>{p.examiner_address}</div>}
      <div className="muted">
        {p.examiner_email}
        {p.examiner_contact ? ` · ${p.examiner_contact}` : ''}
      </div>
    </div>
  );
}

function DispatchModal({ paper, onClose }) {
  const [f, setF] = useState({ courier_ref: '', no_of_scripts: paper.no_of_scripts || '', dispatched_date: todayISO() });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <FormModal
      title={`Courier ${paper.subject_code} scripts to the second examiner`}
      submitLabel="Record dispatch and notify examiner"
      onClose={onClose}
      onSubmit={async () => (await api(`/ar/papers/${paper.paper_id}/dispatch`, { method: 'POST', body: f })).message}
    >
      <ExaminerCard p={paper} />
      <div className="form-grid three">
        <Field label="Courier reference">
          <input value={f.courier_ref} onChange={set('courier_ref')} placeholder="SLP-CR-10500" required />
        </Field>
        <Field label="Number of scripts">
          <input type="number" min={1} value={f.no_of_scripts} onChange={set('no_of_scripts')} required />
        </Field>
        <Field label="Dispatched on">
          <input type="date" value={f.dispatched_date} onChange={set('dispatched_date')} required />
        </Field>
      </div>
      <p className="muted small">The examiner is informed of the subject code and number of scripts sent.</p>
    </FormModal>
  );
}

function ReceivedModal({ paper, onClose }) {
  const [date, setDate] = useState(todayISO());
  return (
    <FormModal
      title="Second examiner confirmed receipt"
      submitLabel="Save"
      onClose={onClose}
      onSubmit={async () => (await api(`/ar/papers/${paper.paper_id}/examiner-received`, { method: 'POST', body: { examiner_received_date: date } })).message}
    >
      <p className="muted">
        {paperTitle(paper)} · couriered {fmtDate(paper.dispatched_date)} ({paper.courier_ref}) to {paper.examiner_name}. The examiner has one month from
        this date to return the scripts and report.
      </p>
      <Field label="Received by examiner on">
        <input type="date" value={date} min={paper.dispatched_date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
    </FormModal>
  );
}

function ReportModal({ paper, onClose }) {
  const [f, setF] = useState({ returned_date: todayISO(), ar_received_date: todayISO(), report_date: todayISO() });
  const [file, setFile] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.append(k, v));
    form.append('file', file);
    return (await api(`/ar/papers/${paper.paper_id}/second-report`, { method: 'POST', form })).message;
  }
  return (
    <FormModal title="Scripts and second marker report received" submitLabel="Save and notify lecturer" onClose={onClose} onSubmit={submit}>
      <p className="muted">
        {paperTitle(paper)} · {paper.examiner_name}
      </p>
      <div className="form-grid three">
        <Field label="Sent back by examiner on">
          <input type="date" value={f.returned_date} min={paper.examiner_received_date} onChange={set('returned_date')} required />
        </Field>
        <Field label="Received by AR on">
          <input type="date" value={f.ar_received_date} min={f.returned_date} onChange={set('ar_received_date')} required />
        </Field>
        <Field label="Report date">
          <input type="date" value={f.report_date} onChange={set('report_date')} required />
        </Field>
      </div>
      <Field label="Second marker report (PDF)" full>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files[0])} required />
      </Field>
    </FormModal>
  );
}

function ForwardModal({ paper, onClose }) {
  return (
    <FormModal
      title="Forward documents to the HOD"
      submitLabel="Forward to HOD"
      onClose={onClose}
      onSubmit={async () => (await api(`/ar/papers/${paper.paper_id}/forward-to-hod`, { method: 'POST' })).message}
    >
      <p>
        The HOD will receive the latest detail marksheet and the second marker report for <strong>{paperTitle(paper)}</strong>.
      </p>
      <div className="doc-links">
        <PdfButton file={paper.latest_marksheet_pdf}>Detail marksheet v{paper.latest_version}</PdfButton>
        <PdfButton file={paper.report_pdf}>2nd marker report</PdfButton>
      </div>
    </FormModal>
  );
}

const FILTERS = {
  ready: { label: 'Ready to courier', test: (p) => p.stage === 'RETURNED_BY_LECTURER' },
  dispatched: { label: 'In transit', test: (p) => p.stage === 'DISPATCHED' },
  with: { label: 'With examiners', test: (p) => p.stage === 'WITH_SECOND_EXAMINER' },
  reports: { label: 'Reports to forward', test: (p) => p.stage === 'SECOND_REPORT_RECEIVED' },
  done: { label: 'Forwarded', test: (p) => !!p.sent_to_hod_at },
};

export default function ArSecondMarking() {
  const { data, loading, error, reload } = useApi('/ar/papers');
  const [tab, setTab] = useState('ready');
  const [modal, setModal] = useState(null);
  const [view, setView] = useState(null);

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const papers = data.papers.filter(FILTERS[tab].test);
  const open = (type, paper) => setModal({ type, paper });
  const close = (saved) => {
    setModal(null);
    if (saved) reload();
  };

  return (
    <>
      <PageHeader title="Second marking" subtitle="Courier marked scripts to second examiners, record their return and forward reports to the HOD" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: data.papers.filter(f.test).length }))}
      />
      <div className="card">
        {papers.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Second examiner</th>
                  <th>Courier</th>
                  <th>Examiner received</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.paper_id} className={p.examiner_overdue ? 'row-danger' : ''}>
                    <td>
                      <strong>{p.subject_code}</strong>
                      <div className="muted small">{p.lecturer_name}</div>
                    </td>
                    <td>
                      {p.examiner_name || <span className="badge tone-orange">Not nominated by lecturer</span>}
                      {p.examiner_name && <div className="muted small">{p.examiner_affiliation}</div>}
                    </td>
                    <td className="small">
                      {p.dispatched_date ? (
                        <>
                          {fmtDate(p.dispatched_date)} · {p.courier_ref}
                          <div className="muted">{p.dispatched_scripts} scripts · examiner notified {fmtDateTime(p.examiner_notified_at)}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="small">
                      {p.examiner_received_date ? (
                        <>
                          {fmtDate(p.examiner_received_date)}
                          <div>
                            Due {fmtDate(p.examiner_due_date)} <DueTag days={p.examiner_days_left} done={!!p.examiner_returned_date} />
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <StageBadge paper={p} />
                    </td>
                    <td className="right nowrap">
                      <button className="btn btn-sm btn-ghost" onClick={() => setView(p.paper_id)}>
                        View
                      </button>
                      {tab === 'ready' && (
                        <button className="btn btn-sm btn-primary" disabled={!p.second_examiner_id} onClick={() => open('dispatch', p)}>
                          Courier scripts
                        </button>
                      )}
                      {tab === 'dispatched' && (
                        <button className="btn btn-sm btn-primary" onClick={() => open('received', p)}>
                          Examiner received
                        </button>
                      )}
                      {tab === 'with' && (
                        <button className="btn btn-sm btn-primary" onClick={() => open('report', p)}>
                          Record return & report
                        </button>
                      )}
                      {tab === 'reports' && (
                        <button className="btn btn-sm btn-primary" disabled={!p.latest_version} onClick={() => open('forward', p)}>
                          Forward to HOD
                        </button>
                      )}
                      {tab === 'done' && <PdfButton file={p.report_pdf}>Report</PdfButton>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nothing in this list" />
        )}
      </div>
      {modal?.type === 'dispatch' && <DispatchModal paper={modal.paper} onClose={close} />}
      {modal?.type === 'received' && <ReceivedModal paper={modal.paper} onClose={close} />}
      {modal?.type === 'report' && <ReportModal paper={modal.paper} onClose={close} />}
      {modal?.type === 'forward' && <ForwardModal paper={modal.paper} onClose={close} />}
      {view && <PaperDetailModal paperId={view} onClose={() => setView(null)} />}
    </>
  );
}
