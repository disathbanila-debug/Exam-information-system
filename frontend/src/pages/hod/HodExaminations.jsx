import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import PaperDetailModal from '../../components/PaperDetail.jsx';
import { EmptyState, ErrorBox, Field, FormModal, Loader, PageHeader, StageBadge } from '../../components/ui.jsx';
import { fmtDate, fmtTime } from '../../utils/format.js';
import { useApi } from '../../utils/useApi.js';

function NewExamModal({ onClose }) {
  const [f, setF] = useState({ exam_name: '', academic_year: '2025/2026', year_of_study: 1, semester: 1, start_date: '', end_date: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const days = f.start_date && f.end_date ? Math.round((new Date(f.end_date) - new Date(f.start_date)) / 86400000) + 1 : null;
  return (
    <FormModal
      title="New examination"
      submitLabel="Create examination"
      onClose={onClose}
      onSubmit={async () => (await api('/hod/examinations', { method: 'POST', body: f })).message}
    >
      <div className="form-grid">
        <Field label="Examination name" full>
          <input value={f.exam_name} onChange={set('exam_name')} placeholder="Year 1 - Semester 1 Examination" required />
        </Field>
        <Field label="Academic year">
          <input value={f.academic_year} onChange={set('academic_year')} required />
        </Field>
        <Field label="Year">
          <select value={f.year_of_study} onChange={set('year_of_study')}>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semester">
          <select value={f.semester} onChange={set('semester')}>
            <option value={1}>Semester 1</option>
            <option value={2}>Semester 2</option>
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={f.start_date} onChange={set('start_date')} required />
        </Field>
        <Field label="End date" hint={days ? `${days} days${days > 31 ? ' – longer than the usual one month' : ''}` : 'An examination usually runs for about one month'}>
          <input type="date" value={f.end_date} min={f.start_date} onChange={set('end_date')} required />
        </Field>
      </div>
    </FormModal>
  );
}

function AddPaperModal({ exam, papers, onClose }) {
  const { data } = useApi('/hod/subjects');
  const used = new Set(papers.map((p) => p.subject_code));
  const subjects = (data?.subjects || []).filter((s) => !used.has(s.subject_code));
  const [f, setF] = useState({ subject_code: '', exam_date: exam.start_date, start_time: '09:00', end_time: '12:00', venue: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const match = (s) => s.year_of_study === exam.year_of_study && s.semester === exam.semester;
  return (
    <FormModal
      title={`Add paper to ${exam.exam_name}`}
      submitLabel="Add to timetable"
      onClose={onClose}
      onSubmit={async () => (await api(`/hod/examinations/${exam.exam_id}/papers`, { method: 'POST', body: f })).message}
    >
      <div className="form-grid">
        <Field label="Subject" full>
          <select value={f.subject_code} onChange={set('subject_code')} required>
            <option value="">Choose a subject…</option>
            {[...subjects.filter(match), ...subjects.filter((s) => !match(s))].map((s) => (
              <option key={s.subject_code} value={s.subject_code}>
                {s.subject_code} – {s.subject_name} (Y{s.year_of_study}S{s.semester}){s.lecturer_name ? ` · ${s.lecturer_name}` : ' · no lecturer'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exam date">
          <input type="date" value={f.exam_date} min={exam.start_date} max={exam.end_date} onChange={set('exam_date')} required />
        </Field>
        <Field label="Venue">
          <input value={f.venue} onChange={set('venue')} placeholder="Main Hall A" required />
        </Field>
        <Field label="Start time">
          <input type="time" value={f.start_time} onChange={set('start_time')} required />
        </Field>
        <Field label="End time">
          <input type="time" value={f.end_time} onChange={set('end_time')} required />
        </Field>
      </div>
    </FormModal>
  );
}

export default function HodExaminations() {
  const exams = useApi('/hod/examinations');
  const [selected, setSelected] = useState(null);
  const detail = useApi(selected ? `/hod/examinations/${selected}` : null);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState(null);

  const list = exams.data?.examinations || [];
  useEffect(() => {
    if (!selected && list.length) setSelected(list[0].exam_id);
  }, [list, selected]);

  const closeModal = (saved) => {
    setModal(null);
    if (saved) {
      exams.reload();
      detail.reload();
    }
  };

  if (exams.loading && !exams.data) return <Loader />;
  if (exams.error && !exams.data) return <ErrorBox message={exams.error} onRetry={exams.reload} />;

  const exam = detail.data?.exam;
  const papers = detail.data?.papers || [];

  return (
    <>
      <PageHeader
        title="Exam timetable"
        subtitle="Create each examination and prepare its timetable"
        actions={
          <button className="btn btn-primary" onClick={() => setModal('exam')}>
            + New examination
          </button>
        }
      />
      <div className="split">
        <div className="exam-list">
          {list.map((e) => (
            <button key={e.exam_id} className={`exam-item ${selected === e.exam_id ? 'active' : ''}`} onClick={() => setSelected(e.exam_id)}>
              <strong>{e.exam_name}</strong>
              <span className="muted small">
                {fmtDate(e.start_date)} – {fmtDate(e.end_date)} · {e.duration_days} days
              </span>
              <span className="muted small">
                {e.academic_year} · {e.paper_count} paper{e.paper_count === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          {!list.length && <EmptyState title="No examinations yet" text="Create the first one" />}
        </div>

        <div className="card grow">
          {!exam && detail.loading && <Loader />}
          {exam && (
            <>
              <div className="card-head">
                <div>
                  <h3>{exam.exam_name}</h3>
                  <span className="muted small">
                    {exam.academic_year} · Year {exam.year_of_study}, Semester {exam.semester} · {fmtDate(exam.start_date)} –{' '}
                    {fmtDate(exam.end_date)}
                  </span>
                </div>
                <button className="btn btn-outline" onClick={() => setModal('paper')}>
                  + Add paper
                </button>
              </div>
              {papers.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Lecturer</th>
                        <th>Venue</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {[...papers]
                        .sort((a, b) => `${a.exam_date}${a.start_time}`.localeCompare(`${b.exam_date}${b.start_time}`))
                        .map((p) => (
                          <tr key={p.paper_id}>
                            <td>{fmtDate(p.exam_date)}</td>
                            <td className="nowrap">
                              {fmtTime(p.start_time)} – {fmtTime(p.end_time)}
                            </td>
                            <td>
                              <strong>{p.subject_code}</strong>
                              <div className="muted small">{p.subject_name}</div>
                            </td>
                            <td>{p.lecturer_name || <span className="muted">Not assigned</span>}</td>
                            <td>{p.venue}</td>
                            <td>
                              <StageBadge paper={p} />
                            </td>
                            <td className="right nowrap">
                              <button className="btn btn-sm btn-outline" onClick={() => setView(p.paper_id)}>
                                View
                              </button>
                              {p.stage === 'SCHEDULED' && (
                                <button className="btn btn-sm btn-ghost danger-text" onClick={() => setModal({ remove: p })}>
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No papers in this timetable yet" text="Use “Add paper” to schedule subjects" />
              )}
            </>
          )}
        </div>
      </div>

      {modal === 'exam' && <NewExamModal onClose={closeModal} />}
      {modal === 'paper' && exam && <AddPaperModal exam={exam} papers={papers} onClose={closeModal} />}
      {modal?.remove && (
        <FormModal
          title="Remove from timetable"
          submitLabel="Remove"
          danger
          onClose={closeModal}
          onSubmit={async () => (await api(`/hod/papers/${modal.remove.paper_id}`, { method: 'DELETE' })).message}
        >
          <p>
            Remove <strong>{modal.remove.subject_code} – {modal.remove.subject_name}</strong> from {exam?.exam_name}?
          </p>
        </FormModal>
      )}
      {view && <PaperDetailModal paperId={view} onClose={() => setView(null)} />}
    </>
  );
}
