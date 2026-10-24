import { useState } from 'react';
import { api } from '../../api.js';
import { ErrorBox, Field, FormModal, Loader, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../utils/useApi.js';

function AddLecturerModal({ onClose }) {
  const { data } = useApi('/lookups');
  const [f, setF] = useState({
    title: 'Mr.',
    initials: '',
    surname: '',
    grade_level: 2,
    dept_id: '',
    email: '',
    contact_numbers: '',
    password: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <FormModal
      title="Add lecturer"
      submitLabel="Create account"
      onClose={onClose}
      wide
      onSubmit={async () => (await api('/hod/lecturers', { method: 'POST', body: f })).message}
    >
      <div className="form-grid three">
        <Field label="Title">
          <select value={f.title} onChange={set('title')}>
            {['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Initials">
          <input value={f.initials} onChange={set('initials')} placeholder="A.B." required />
        </Field>
        <Field label="Surname">
          <input value={f.surname} onChange={set('surname')} required />
        </Field>
        <Field label="Grade / designation" hint="Used for the second examiner rule">
          <select value={f.grade_level} onChange={set('grade_level')}>
            {(data?.grades || []).map((g) => (
              <option key={g.level} value={g.level}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department" full>
          <select value={f.dept_id} onChange={set('dept_id')} required>
            <option value="">Choose a department…</option>
            {(data?.departments || []).map((d) => (
              <option key={d.dept_id} value={d.dept_id}>
                {d.dept_name} – {d.faculty_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email (login)">
          <input type="email" value={f.email} onChange={set('email')} required />
        </Field>
        <Field label="Contact numbers" hint="Separate several numbers with commas">
          <input value={f.contact_numbers} onChange={set('contact_numbers')} placeholder="0771234567, 0252266000" />
        </Field>
        <Field label="Temporary password" hint="At least 6 characters">
          <input type="text" value={f.password} onChange={set('password')} minLength={6} required />
        </Field>
      </div>
    </FormModal>
  );
}

export default function HodLecturers() {
  const { data, loading, error, reload } = useApi('/hod/lecturers');
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function toggle(l) {
    try {
      const r = await api(`/hod/lecturers/${l.user_id}/status`, { method: 'PATCH', body: { is_active: !l.is_active } });
      toast.success(r.message);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Lecturers"
        subtitle="Lecturers of the university. Senior staff from any department can be chosen as internal second examiners."
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add lecturer
          </button>
        }
      />
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Email</th>
                <th>Contact numbers</th>
                <th>Subjects</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {data.lecturers.map((l) => (
                <tr key={l.user_id} className={l.is_active ? '' : 'inactive'}>
                  <td>
                    <strong>{l.name}</strong>
                    {l.role === 'HOD' && <span className="badge tone-indigo">HOD</span>}
                  </td>
                  <td>{l.designation}</td>
                  <td>
                    {l.dept_name}
                    <div className="muted small">{l.faculty_name}</div>
                  </td>
                  <td>{l.email}</td>
                  <td>{l.contact_numbers || '—'}</td>
                  <td>{l.subject_count}</td>
                  <td>
                    {l.role === 'LECTURER' ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => toggle(l)}>
                        {l.is_active ? 'Active · deactivate' : 'Inactive · activate'}
                      </button>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {adding && (
        <AddLecturerModal
          onClose={(saved) => {
            setAdding(false);
            if (saved) reload();
          }}
        />
      )}
    </>
  );
}
