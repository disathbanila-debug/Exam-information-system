import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { HOME_BY_ROLE, useAuth } from '../context/AuthContext.jsx';

const ROLES = [
  { name: 'Head of Department', text: 'Timetables, monitoring, final approval', tone: 'hod' },
  { name: 'Lecturer', text: 'Second examiner, marking reports, final marksheets', tone: 'lecturer' },
  { name: 'AR Office', text: 'Answer scripts, courier and second marking', tone: 'ar' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(HOME_BY_ROLE[u.role], { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="brand-mark big">EIS</div>
        <h1>Exam Information System</h1>
        <p>Computing Department · Faculty of Applied Sciences · Rajarata University of Sri Lanka</p>
        <ul className="role-list">
          {ROLES.map((r) => (
            <li key={r.name} className={`role-item role-${r.tone}`}>
              <strong>{r.name}</strong>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="muted">Use your staff email. You will be taken to your own portal.</p>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}
