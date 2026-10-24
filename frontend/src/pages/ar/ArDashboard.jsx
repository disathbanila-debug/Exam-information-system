import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, Loader, PageHeader, StageBadge, StatCard } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';
import { arNextAction } from '../../utils/stages.js';
import { useApi } from '../../utils/useApi.js';

const SECOND_MARKING = ['RETURNED_BY_LECTURER', 'DISPATCHED', 'WITH_SECOND_EXAMINER', 'SECOND_REPORT_RECEIVED'];

export default function ArDashboard() {
  const { data, loading, error, reload } = useApi('/ar/papers');

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const papers = data.papers;
  const count = (fn) => papers.filter(fn).length;
  const todo = papers.map((p) => ({ ...p, next: arNextAction(p) })).filter((p) => p.next);

  return (
    <>
      <PageHeader title="AR Office dashboard" subtitle="Answer scripts and second marking for the Computing Department" />
      <div className="stats">
        <StatCard label="Scripts to record" value={count((p) => p.stage === 'SCHEDULED' && p.exam_held)} hint="Exams held, scripts not recorded" to="/ar/scripts" />
        <StatCard label="Awaiting collection" value={count((p) => p.stage === 'AT_AR_OFFICE')} hint="Lecturers notified" to="/ar/scripts" />
        <StatCard
          label="With lecturers"
          value={count((p) => p.stage === 'WITH_LECTURER')}
          hint={`${count((p) => p.lecturer_overdue)} overdue`}
          tone={count((p) => p.lecturer_overdue) ? 'danger' : 'default'}
          to="/ar/scripts"
        />
        <StatCard
          label="With 2nd examiners"
          value={count((p) => ['DISPATCHED', 'WITH_SECOND_EXAMINER'].includes(p.stage))}
          hint={`${count((p) => p.examiner_overdue)} overdue`}
          tone={count((p) => p.examiner_overdue) ? 'danger' : 'default'}
          to="/ar/second-marking"
        />
        <StatCard label="Reports to forward" value={count((p) => p.stage === 'SECOND_REPORT_RECEIVED')} tone="accent" to="/ar/second-marking" />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Action required</h3>
          <span className="muted small">{todo.length} item(s)</span>
        </div>
        {todo.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Exam date</th>
                  <th>Lecturer</th>
                  <th>Status</th>
                  <th>Next step</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {todo.map((p) => (
                  <tr key={p.paper_id}>
                    <td>
                      <strong>{p.subject_code}</strong>
                      <div className="muted small">{p.subject_name}</div>
                    </td>
                    <td>{fmtDate(p.exam_date)}</td>
                    <td>{p.lecturer_name}</td>
                    <td>
                      <StageBadge paper={p} />
                      {(p.lecturer_overdue || p.examiner_overdue) && <span className="badge tone-red">Overdue</span>}
                    </td>
                    <td>
                      <span className="next-action">{p.next}</span>
                    </td>
                    <td className="right">
                      <Link className="btn btn-sm btn-primary" to={SECOND_MARKING.includes(p.stage) ? '/ar/second-marking' : '/ar/scripts'}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nothing to do right now" />
        )}
      </div>
    </>
  );
}
