import { useMemo, useState } from 'react';
import PaperDetailModal from '../../components/PaperDetail.jsx';
import { EmptyState, ErrorBox, Loader, PageHeader, StageBadge, StatCard } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';
import { STAGES } from '../../utils/stages.js';
import { useApi } from '../../utils/useApi.js';

export default function HodDashboard() {
  const { data, loading, error, reload } = useApi('/hod/papers');
  const [exam, setExam] = useState('all');
  const [stage, setStage] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const papers = data?.papers || [];
  const exams = useMemo(() => [...new Map(papers.map((p) => [p.exam_id, p.exam_name])).entries()], [papers]);
  const filtered = papers.filter(
    (p) =>
      (exam === 'all' || String(p.exam_id) === exam) &&
      (stage === 'all' || p.stage === stage) &&
      `${p.subject_code} ${p.subject_name} ${p.lecturer_name}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const count = (...keys) => papers.filter((p) => keys.includes(p.stage)).length;
  const lecOverdue = papers.filter((p) => p.lecturer_overdue);
  const exOverdue = papers.filter((p) => p.examiner_overdue);

  return (
    <>
      <PageHeader title="Department overview" subtitle="Live status of every exam paper, from the timetable to the Exam Branch" />

      <div className="stats">
        <StatCard label="Exam papers" value={papers.length} hint={`${count('SCHEDULED')} not yet held / received`} />
        <StatCard
          label="Scripts with lecturers"
          value={count('WITH_LECTURER')}
          hint={`${lecOverdue.length} overdue (3 months)`}
          tone={lecOverdue.length ? 'danger' : 'default'}
          to="/hod/monitoring"
        />
        <StatCard
          label="With 2nd examiners"
          value={count('DISPATCHED', 'WITH_SECOND_EXAMINER')}
          hint={`${exOverdue.length} overdue (1 month)`}
          tone={exOverdue.length ? 'danger' : 'default'}
          to="/hod/monitoring"
        />
        <StatCard label="Awaiting your approval" value={count('FINAL_SUBMITTED')} tone="accent" to="/hod/approvals" />
        <StatCard label="Sent to Exam Branch" value={count('SENT_TO_EXAM_BRANCH')} tone="success" />
      </div>

      {(lecOverdue.length > 0 || exOverdue.length > 0) && (
        <div className="card alert-card">
          <h3>Needs attention</h3>
          <ul className="alert-list">
            {lecOverdue.map((p) => (
              <li key={`l${p.paper_id}`}>
                <strong>{p.subject_code}</strong> – {p.lecturer_name} has not returned the marked scripts (due{' '}
                {fmtDate(p.collection_due_date)}, {-p.lecturer_days_left} days overdue)
              </li>
            ))}
            {exOverdue.map((p) => (
              <li key={`e${p.paper_id}`}>
                <strong>{p.subject_code}</strong> – second examiner {p.examiner_name} has not returned the scripts (due{' '}
                {fmtDate(p.examiner_due_date)}, {-p.examiner_days_left} days overdue)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>All exam papers</h3>
          <div className="filters">
            <input placeholder="Search subject or lecturer" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={exam} onChange={(e) => setExam(e.target.value)}>
              <option value="all">All examinations</option>
              {exams.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="all">All stages</option>
              {STAGES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Examination</th>
                  <th>Exam date</th>
                  <th>Lecturer</th>
                  <th>2nd examiner</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.paper_id}>
                    <td>
                      <strong>{p.subject_code}</strong>
                      <div className="muted small">{p.subject_name}</div>
                    </td>
                    <td className="small">{p.exam_name}</td>
                    <td>{fmtDate(p.exam_date)}</td>
                    <td>{p.lecturer_name || <span className="muted">Not assigned</span>}</td>
                    <td>{p.examiner_name || <span className="muted">Not nominated</span>}</td>
                    <td>
                      <StageBadge paper={p} />
                      {(p.lecturer_overdue || p.examiner_overdue) && <span className="badge tone-red">Overdue</span>}
                    </td>
                    <td className="right">
                      <button className="btn btn-sm btn-outline" onClick={() => setDetail(p.paper_id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No exam papers match these filters" />
        )}
      </div>

      {detail && <PaperDetailModal paperId={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
