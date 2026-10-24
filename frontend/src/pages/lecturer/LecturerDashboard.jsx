import { Link } from 'react-router-dom';
import { DueTag, EmptyState, ErrorBox, Loader, PageHeader, ProgressBar, StageBadge, StatCard } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate, fmtTime } from '../../utils/format.js';
import { lecturerNextAction } from '../../utils/stages.js';
import { useApi } from '../../utils/useApi.js';

export default function LecturerDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/lecturer/papers');

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const papers = data.papers.map((p) => ({ ...p, next: lecturerNextAction(p) }));
  const withMe = papers.filter((p) => p.stage === 'WITH_LECTURER');
  const overdue = papers.filter((p) => p.lecturer_overdue);
  // papers needing action first, then by exam date
  const sorted = [...papers].sort((a, b) => (!!b.next - !!a.next) || a.exam_date.localeCompare(b.exam_date));

  return (
    <>
      <PageHeader title={`Welcome, ${user.title} ${user.surname}`} subtitle={`${user.designation} · ${user.dept_name}`} />
      <div className="stats">
        <StatCard label="My exam papers" value={papers.length} />
        <StatCard label="Need your action" value={papers.filter((p) => p.next).length} tone="accent" />
        <StatCard
          label="Scripts with me"
          value={withMe.length}
          hint={overdue.length ? `${overdue.length} past the 3-month limit` : 'Return within 3 months'}
          tone={overdue.length ? 'danger' : 'default'}
        />
        <StatCard label="Sent to Exam Branch" value={papers.filter((p) => p.stage === 'SENT_TO_EXAM_BRANCH').length} tone="success" />
      </div>

      {sorted.length ? (
        <div className="paper-grid">
          {sorted.map((p) => (
            <Link key={p.paper_id} to={`/lecturer/papers/${p.paper_id}`} className={`card paper-card ${p.next ? 'needs-action' : ''}`}>
              <div className="paper-card-head">
                <div>
                  <strong>{p.subject_code}</strong>
                  <div className="paper-name">{p.subject_name}</div>
                </div>
                <StageBadge paper={p} />
              </div>
              <div className="muted small">
                {p.exam_name} · {fmtDate(p.exam_date)}, {fmtTime(p.start_time)} · {p.venue}
              </div>
              <ProgressBar step={p.stage_step} total={p.total_steps} />
              <div className="paper-card-foot">
                {p.next ? <span className="next-action">→ {p.next}</span> : <span className="muted small">No action needed</span>}
                {p.stage === 'WITH_LECTURER' && <DueTag days={p.lecturer_days_left} />}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState title="No exam papers yet" text="Papers appear here when the HOD adds your subjects to an exam timetable" />
        </div>
      )}
    </>
  );
}
