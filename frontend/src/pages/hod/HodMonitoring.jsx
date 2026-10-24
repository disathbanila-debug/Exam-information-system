import { useState } from 'react';
import PaperDetailModal from '../../components/PaperDetail.jsx';
import { DueTag, EmptyState, ErrorBox, Loader, PageHeader, PdfButton, Tabs } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime } from '../../utils/format.js';
import { useApi } from '../../utils/useApi.js';

function CollectionTable({ papers, onView }) {
  if (!papers.length) return <EmptyState title="No answer scripts have reached the AR office yet" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Lecturer</th>
            <th>Scripts at AR</th>
            <th>Collected by</th>
            <th>Collected on</th>
            <th>Return due</th>
            <th>Returned on</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {papers.map((p) => (
            <tr key={p.paper_id} className={p.lecturer_overdue ? 'row-danger' : ''}>
              <td>
                <strong>{p.subject_code}</strong>
                <div className="muted small">{p.exam_name}</div>
              </td>
              <td>{p.lecturer_name}</td>
              <td>
                {fmtDateTime(p.scripts_received_at)}
                <div className="muted small">{p.no_of_scripts} scripts</div>
              </td>
              <td>{p.collected_by_name || <span className="badge tone-blue">Awaiting collection</span>}</td>
              <td>{fmtDateTime(p.collected_at)}</td>
              <td>
                {fmtDate(p.collection_due_date)} <DueTag days={p.lecturer_days_left} done={!!p.returned_at || !p.collected_at} />
              </td>
              <td>{p.returned_at ? fmtDate(p.returned_at) : <span className="muted">Not returned</span>}</td>
              <td className="right">
                <button className="btn btn-sm btn-outline" onClick={() => onView(p.paper_id)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecondMarkingTable({ papers, onView }) {
  if (!papers.length) return <EmptyState title="No second examiners have been nominated yet" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Second examiner</th>
            <th>Couriered</th>
            <th>Examiner received</th>
            <th>Return due</th>
            <th>Back at AR</th>
            <th>2nd marker report</th>
            <th>Forwarded to you</th>
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
                {p.examiner_name}
                <div className="muted small">
                  {p.examiner_type === 'INTERNAL' ? 'Internal' : 'External'} · {p.examiner_affiliation}
                </div>
              </td>
              <td>
                {p.dispatched_date ? (
                  <>
                    {fmtDate(p.dispatched_date)}
                    <div className="muted small">
                      {p.courier_ref} · {p.dispatched_scripts} scripts
                    </div>
                  </>
                ) : (
                  <span className="muted">Not yet</span>
                )}
              </td>
              <td>{fmtDate(p.examiner_received_date)}</td>
              <td>
                {fmtDate(p.examiner_due_date)} <DueTag days={p.examiner_days_left} done={!!p.examiner_returned_date || !p.examiner_received_date} />
              </td>
              <td>{fmtDate(p.ar_received_date)}</td>
              <td>
                <PdfButton file={p.report_pdf} />
              </td>
              <td>{fmtDateTime(p.sent_to_hod_at)}</td>
              <td className="right">
                <button className="btn btn-sm btn-outline" onClick={() => onView(p.paper_id)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverdueList({ papers }) {
  const lec = papers.filter((p) => p.lecturer_overdue);
  const ex = papers.filter((p) => p.examiner_overdue);
  if (!lec.length && !ex.length) return <EmptyState title="Nothing is overdue" text="All scripts are within their time limits" />;
  return (
    <div className="overdue-grid">
      <section>
        <h4>Not returned by lecturers (3-month limit)</h4>
        {lec.map((p) => (
          <div key={p.paper_id} className="overdue-item">
            <strong>
              {p.subject_code} – {p.subject_name}
            </strong>
            <span>{p.lecturer_name}</span>
            <span className="muted small">
              Collected {fmtDateTime(p.collected_at)} · due {fmtDate(p.collection_due_date)}
            </span>
            <DueTag days={p.lecturer_days_left} />
          </div>
        ))}
        {!lec.length && <p className="muted">None</p>}
      </section>
      <section>
        <h4>Not returned by second examiners (1-month limit)</h4>
        {ex.map((p) => (
          <div key={p.paper_id} className="overdue-item">
            <strong>
              {p.subject_code} – {p.subject_name}
            </strong>
            <span>{p.examiner_name}</span>
            <span className="muted small">
              Received {fmtDate(p.examiner_received_date)} · due {fmtDate(p.examiner_due_date)} · {p.examiner_email}
            </span>
            <DueTag days={p.examiner_days_left} />
          </div>
        ))}
        {!ex.length && <p className="muted">None</p>}
      </section>
    </div>
  );
}

export default function HodMonitoring() {
  const { data, loading, error, reload } = useApi('/hod/papers');
  const [tab, setTab] = useState('collection');
  const [view, setView] = useState(null);

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const papers = data.papers;
  const atAr = papers.filter((p) => p.scripts_received_at);
  const second = papers.filter((p) => p.second_examiner_id);
  const overdue = papers.filter((p) => p.lecturer_overdue || p.examiner_overdue);

  return (
    <>
      <PageHeader title="Monitoring" subtitle="Who has the answer scripts, since when, and what is overdue" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'collection', label: 'Script collection', count: atAr.length },
          { key: 'overdue', label: 'Overdue', count: overdue.length },
          { key: 'second', label: 'Second marking', count: second.length },
        ]}
      />
      <div className="card">
        {tab === 'collection' && <CollectionTable papers={atAr} onView={setView} />}
        {tab === 'overdue' && <OverdueList papers={papers} />}
        {tab === 'second' && <SecondMarkingTable papers={second} onView={setView} />}
      </div>
      <p className="muted small note">Rows in red are overdue. Use “View” to see the full timeline of a paper.</p>
      {view && <PaperDetailModal paperId={view} onClose={() => setView(null)} />}
    </>
  );
}
