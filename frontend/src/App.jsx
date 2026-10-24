import { Navigate, Route, Routes } from 'react-router-dom';
import NotificationsPage from './components/NotificationsPage.jsx';
import PortalLayout from './components/PortalLayout.jsx';
import { Loader } from './components/ui.jsx';
import { HOME_BY_ROLE, useAuth } from './context/AuthContext.jsx';
import ArDashboard from './pages/ar/ArDashboard.jsx';
import ArScripts from './pages/ar/ArScripts.jsx';
import ArSecondMarking from './pages/ar/ArSecondMarking.jsx';
import HodApprovals from './pages/hod/HodApprovals.jsx';
import HodDashboard from './pages/hod/HodDashboard.jsx';
import HodExaminations from './pages/hod/HodExaminations.jsx';
import HodLecturers from './pages/hod/HodLecturers.jsx';
import HodMonitoring from './pages/hod/HodMonitoring.jsx';
import HodSubjects from './pages/hod/HodSubjects.jsx';
import LecturerDashboard from './pages/lecturer/LecturerDashboard.jsx';
import LecturerPaper from './pages/lecturer/LecturerPaper.jsx';
import Login from './pages/Login.jsx';

/** Only lets a logged-in user of `role` into a portal; others go to their own portal. */
function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader text="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/hod"
        element={
          <RequireRole role="HOD">
            <PortalLayout role="HOD" />
          </RequireRole>
        }
      >
        <Route index element={<HodDashboard />} />
        <Route path="examinations" element={<HodExaminations />} />
        <Route path="monitoring" element={<HodMonitoring />} />
        <Route path="approvals" element={<HodApprovals />} />
        <Route path="subjects" element={<HodSubjects />} />
        <Route path="lecturers" element={<HodLecturers />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route
        path="/lecturer"
        element={
          <RequireRole role="LECTURER">
            <PortalLayout role="LECTURER" />
          </RequireRole>
        }
      >
        <Route index element={<LecturerDashboard />} />
        <Route path="papers/:id" element={<LecturerPaper />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route
        path="/ar"
        element={
          <RequireRole role="AR">
            <PortalLayout role="AR" />
          </RequireRole>
        }
      >
        <Route index element={<ArDashboard />} />
        <Route path="scripts" element={<ArScripts />} />
        <Route path="second-marking" element={<ArSecondMarking />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
