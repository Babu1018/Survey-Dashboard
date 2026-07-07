import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './pages/Dashboard';
import SurveyBuilder from './pages/SurveyBuilder';
import Assigner from './pages/Assigner';
import LiveMonitor from './pages/LiveMonitor';
import SurveyForm from './pages/SurveyForm';
import SurveyList from './pages/SurveyList';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import useAuthStore from './store/useAuthStore';
import { Navigate, useLocation } from 'react-router-dom';
import Toast from './components/common/Toast';
import './App.css';

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

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <Router>
      <Toast />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        
        <Route path="*" element={
          <ProtectedRoute>
            {user?.role === 'User' ? (
              <div style={{ 
                minHeight: '100vh', 
                background: 'var(--bg-main)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <header style={{ 
                  background: 'var(--bg-sidebar)', 
                  borderBottom: '1px solid var(--border)',
                  height: '72px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{ 
                    maxWidth: '1400px', 
                    margin: '0 auto', 
                    width: '100%',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0 2.5rem'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent-primary)' }}>Survey Portal</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Logged in as <b>{user.username}</b></span>
                      <button 
                        onClick={() => useAuthStore.getState().logout()}
                        style={{ 
                          background: 'none', 
                          border: '1px solid var(--border)', 
                          padding: '5px 12px', 
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'var(--text-main)'
                        }}
                      >Sign Out</button>
                    </div>
                  </div>
                </header>
                <main style={{ flexGrow: 1, overflowY: 'auto', padding: '2rem' }}>
                  <Routes>
                    <Route path="/take" element={<SurveyForm />} />
                    <Route path="*" element={<Navigate to="/take" replace />} />
                  </Routes>
                </main>
              </div>
            ) : (
              <div id="app-container" className={isCollapsed ? 'collapsed' : ''}>
                <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden', minWidth: 0 }}>
                  <TopBar isDark={isDark} setIsDark={setIsDark} />
                  <main id="main-content" style={{ flexGrow: 1, overflowY: 'auto', padding: 'clamp(1rem, 2vw, 2.5rem)' }}>
                    <div style={{ maxWidth: 'min(1400px, 100%)', margin: '0 auto', width: '100%' }}>
                    <Routes>
                      <Route path="/" element={<SurveyList />} />
                      <Route path="/builder/:id?" element={<SurveyBuilder />} />
                      <Route path="/surveys" element={<SurveyList />} />
                      <Route path="/assigner" element={<Assigner />} />
                      <Route path="/monitor" element={<LiveMonitor />} />
                      <Route path="/take" element={<SurveyForm />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    </div>
                  </main>
                </div>
              </div>
            )}
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}


export default App;
