import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import ManagerDashboard from '../pages/ManagerDashboard';
import MySurveyDashboard from '../pages/MySurveyDashboard';
import SurveyBuilder from '../pages/SurveyBuilder';
import Assigner from '../pages/Assigner';
import LiveMonitor from '../pages/LiveMonitor';
import SurveyForm from '../pages/SurveyForm';
import SurveyList from '../pages/SurveyList';
import SurveyBranch from '../pages/SurveyBranch';
import SurveyReport from '../pages/SurveyReport';
import UserLogs from '../pages/UserLogs';
import UsersOverview from '../pages/UsersOverview';
import UserDetail from '../pages/UserDetail';
import SurveyReview from '../pages/SurveyReview';
import SubmissionReview from '../pages/SubmissionReview';
import Login from '../pages/Login';
import ForgotPassword from '../pages/ForgotPassword';
import ChangePassword from '../pages/ChangePassword';
import useAuthStore from '../store/useAuthStore';
import MainLayout from '../layouts/MainLayout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.is_first_login && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/change-password" element={<ChangePassword />} />

      <Route path="/surveys/:id/report" element={
        <ProtectedRoute>
          <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
            <SurveyReport />
          </div>
        </ProtectedRoute>
      } />

      <Route path="*" element={
        <ProtectedRoute>
          <MainLayout>
            <Routes>
              <Route path="/" element={
                user?.role === 'Manager' ? <ManagerDashboard />
                  : user?.role === 'User' ? <MySurveyDashboard />
                  : <Dashboard />
              } />
              {user?.role === 'Admin' && (
                <>
                  <Route path="/builder/:id?" element={<SurveyBuilder />} />
                  <Route path="/surveys" element={<SurveyList />} />
                  <Route path="/surveys/branch/:category" element={<SurveyBranch />} />
                  <Route path="/assigner" element={<Assigner />} />
                </>
              )}
              {(user?.role === 'Admin' || user?.role === 'User') && (
                <Route path="/take" element={<SurveyForm />} />
              )}
              {user?.role === 'Manager' && (
                <Route path="/monitor" element={<LiveMonitor />} />
              )}
              {(user?.role === 'Admin' || user?.role === 'Manager') && (
                <>
                  <Route path="/user-logs" element={<UserLogs />} />
                  <Route path="/users" element={<UsersOverview />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                  <Route path="/review" element={<SurveyReview />} />
                  <Route path="/review/:id" element={<SubmissionReview />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;
