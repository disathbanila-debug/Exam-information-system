import { useState } from 'react';
import { api } from '../../api.js';
import { EmptyState, ErrorBox, Field, FormModal, Loader, PageHeader } from '../../components/ui.jsx';
import { useApi } from '../../utils/useApi.js';

function SubjectModal({ subject, lecturers, onClose }) {
  const editing = !!subject;
  const [f, setF] = useState(
    subject
      ? { ...subject, lecturer_id: subject.lecturer_id ?? '' }
      : { subject_code: '', subject_name: '', credits: 3, year_of_study: 1, semester: 1, lecturer_id: '' },
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <FormModal
      title={editing ? `Edit ${subject.subject_code}` : 'Add subject'}
      submitLabel={editing ? 'Save changes' : 'Add subject'}
      onClose={onClose}
      onSubmit={async () =>
        (
          await api(editing ? `/hod/subjects/${subject.subject_code}` : '/hod/subjects', {
            method: editing ? 'PUT' : 'POST',
            body: f,
          })
        ).message
      }
    >
      <div className="form-grid">
        <Field label="Subject code">
          <input value={f.subject_code} onChange={set('subject_code')} placeholder="ICT1407" disabled={editing} required />
        </Field>
        <Field label="Credits">
          <input type="number" min={1} max={6} value={f.credits} onChange={set('credits')} required />
        </Field>
        <Field label="Subject name" full>
          <input value={f.subject_name} onChange={set('subject_name')} required />
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
        <Field label="Lecturer in charge" full hint="The lecturer who sets, marks and finalizes this subject's paper">
          <select value={f.lecturer_id} onChange={set('lecturer_id')}>
            <option value="">Not assigned</option>
            {lecturers.map((l) => (
              <option key={l.user_id} value={l.user_id}>
                {l.name} – {l.designation}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </FormModal>
  );
}

export default function HodSubjects() {
  const { data, loading, error, reload } = useApi('/hod/subjects');
  const lect = useApi('/hod/lecturers');
  const [modal, setModal] = useState(null); // 'new' | subject

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const lecturers = (lect.data?.lecturers || []).filter((l) => l.role === 'LECTURER' && l.is_active);
  const subjects = data.subjects;

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Every subject of each year and semester, and the lecturer in charge"
        actions={
          <button className="btn btn-primary" onClick={() => setModal('new')}>
            + Add subject
          </button>
        }
      />
      <div className="card">
        {subjects.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Subject</th>
                  <th>Year / Semester</th>
                  <th>Credits</th>
                  <th>Lecturer in charge</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.subject_code}>
                    <td>
                      <strong>{s.subject_code}</strong>
                    </td>
                    <td>{s.subject_name}</td>
                    <td>
                      Year {s.year_of_study}, Semester {s.semester}
                    </td>
                    <td>{s.credits}</td>
                    <td>{s.lecturer_name || <span className="badge tone-orange">Not assigned</span>}</td>
                    <td className="right">
                      <button className="btn btn-sm btn-outline" onClick={() => setModal(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No subjects yet" />
        )}
      </div>
      {modal && (
        <SubjectModal
          subject={modal === 'new' ? null : modal}
          lecturers={lecturers}
          onClose={(saved) => {
            setModal(null);
            if (saved) reload();
          }}
        />
      )}
    </>
  );
}
