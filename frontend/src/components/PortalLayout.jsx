import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';

// Each role gets its own portal: its own colour theme, menu and pages.
export const PORTALS = {
  HOD: {
    title: 'HOD Portal',
    subtitle: 'Head of Department',
    theme: 'theme-hod',
    base: '/hod',
    nav: [
      ['', 'Dashboard', 'dashboard'],
      ['examinations', 'Exam Timetable', 'calendar'],
      ['monitoring', 'Monitoring', 'activity'],
      ['approvals', 'Final Approvals', 'check'],
      ['subjects', 'Subjects', 'book'],
      ['lecturers', 'Lecturers', 'users'],
      ['notifications', 'Notifications', 'bell'],
    ],
  },
  LECTURER: {
    title: 'Lecturer Portal',
    subtitle: 'Subject Lecturer',
    theme: 'theme-lecturer',
    base: '/lecturer',
    nav: [
      ['', 'My Exam Papers', 'clipboard'],
      ['notifications', 'Notifications', 'bell'],
    ],
  },
  AR: {
    title: 'AR Office Portal',
    subtitle: 'Examinations Branch',
    theme: 'theme-ar',
    base: '/ar',
    nav: [
      ['', 'Dashboard', 'dashboard'],
      ['scripts', 'Answer Scripts', 'inbox'],
      ['second-marking', 'Second Marking', 'truck'],
      ['notifications', 'Notifications', 'bell'],
    ],
  },
};

export default function PortalLayout({ role }) {
  const portal = PORTALS[role];
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    api('/notifications/unread-count')
      .then((d) => setUnread(d.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 30000);
    return () => clearInterval(t);
  }, [refreshUnread, location.pathname]);

  return (
    <div className={`portal ${portal.theme}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EIS</div>
          <div>
            <div className="brand-title">{portal.title}</div>
            <div className="brand-sub">{portal.subtitle}</div>
          </div>
        </div>
        <nav className="nav">
          {portal.nav.map(([path, label, icon]) => (
            <NavLink
              key={label}
              to={path ? `${portal.base}/${path}` : portal.base}
              end={!path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {path === 'notifications' && unread > 0 && <span className="nav-count">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Computing Department
          <br />
          Faculty of Applied Sciences
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Exam Information System</div>
          <div className="topbar-right">
            <Link to={`${portal.base}/notifications`} className="bell" aria-label={`${unread} unread notifications`}>
              <Icon name="bell" />
              {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <div className="user-chip">
              <div className="avatar">{user?.surname?.[0]}</div>
              <div>
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{user?.designation}</div>
              </div>
            </div>
            <button
              className="icon-btn"
              title="Log out"
              aria-label="Log out"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet context={{ refreshUnread }} />
        </main>
      </div>
    </div>
  );
}
