import { auth } from '@/lib/firebase';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen';
import LoginHome from './pages/LoginHome';
import SettingsPage from './pages/Settings';
import SignIn from './pages/SignIn';
import AboutPage from './pages/settings/about';
import DataControlsPage from './pages/settings/data-controls';
import DedicatedInferencePage from './pages/settings/dedicated-inference';
import PersonalizationPage from './pages/settings/personalization';
import StatusPage from './pages/settings/status';

export default function App() {
  const [user, setUser] = React.useState<any | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const RequireAuth = ({ children }: { children: JSX.Element }) => {
    if (!user) return <Navigate to="/login" replace />;
    return children;
  };

  const RedirectIfAuthed = ({ children }: { children: JSX.Element }) => {
    if (user) return <Navigate to="/homescreen" replace />;
    return children;
  };

  // Show loading screen while determining auth state
  if (authLoading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        {/* Main content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{
            marginBottom: '24px',
          }}>
            <img
              src="/logo.png"
              alt="SwitchAi Logo"
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Brand text */}
          <div style={{
            textAlign: 'center',
            marginBottom: '16px',
          }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#000000',
              margin: '0 0 4px 0',
            }}>
              SwitchAi
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#666666',
              margin: 0,
            }}>
              Initializing your experience...
            </p>
          </div>

          {/* Loading indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#cccccc',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out infinite both',
            }} />
            <div style={{
              width: '8px',
              height: '8px',
              background: '#cccccc',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.2s infinite both',
            }} />
            <div style={{
              width: '8px',
              height: '8px',
              background: '#cccccc',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.4s infinite both',
            }} />
          </div>
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root redirects based on auth state */}
      <Route path="/" element={<Navigate to={user ? '/homescreen' : '/login'} replace />} />

      {/* Auth flow: show only if not logged in */}
      <Route path="/login" element={<RedirectIfAuthed><LoginHome /></RedirectIfAuthed>} />
      <Route path="/login/signin" element={<RedirectIfAuthed><SignIn /></RedirectIfAuthed>} />

      {/* Protected area */}
  <Route path="/homescreen" element={<RequireAuth><HomeScreen /></RequireAuth>} />
  <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
  <Route path="/settings/personalization" element={<RequireAuth><PersonalizationPage /></RequireAuth>} />
  <Route path="/settings/data-controls" element={<RequireAuth><DataControlsPage /></RequireAuth>} />
  <Route path="/settings/dedicated-inference" element={<RequireAuth><DedicatedInferencePage /></RequireAuth>} />
  <Route path="/settings/status" element={<RequireAuth><StatusPage /></RequireAuth>} />
  <Route path="/settings/about" element={<RequireAuth><AboutPage /></RequireAuth>} />

      {/* Fallback to appropriate entry based on auth */}
      <Route path="*" element={<Navigate to={user ? '/homescreen' : '/login'} replace />} />
    </Routes>
  );
}
