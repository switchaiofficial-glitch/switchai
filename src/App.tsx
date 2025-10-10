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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden',
      }}>
        {/* Animated background elements */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: '60px',
          height: '60px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '25%',
          right: '15%',
          width: '40px',
          height: '40px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 8s ease-in-out infinite reverse',
        }} />

        {/* Main content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
          animation: 'fadeIn 0.8s ease-out',
        }}>
          {/* Logo container with glow effect */}
          <div style={{
            position: 'relative',
            marginBottom: '24px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              <img
                src="/logo.png"
                alt="SwitchAi Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            {/* Subtle glow ring */}
            <div style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.2))',
              zIndex: -1,
              animation: 'rotate 10s linear infinite',
            }} />
          </div>

          {/* Brand text */}
          <div style={{
            textAlign: 'center',
            marginBottom: '16px',
          }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#f8fafc',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            }}>
              SwitchAi
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              margin: 0,
              fontWeight: '400',
            }}>
              Initializing your experience...
            </p>
          </div>

          {/* Loading indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
          }}>
            <div style={{
              width: '4px',
              height: '4px',
              background: 'rgba(16, 185, 129, 0.8)',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out infinite both',
            }} />
            <div style={{
              width: '4px',
              height: '4px',
              background: 'rgba(16, 185, 129, 0.8)',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.2s infinite both',
            }} />
            <div style={{
              width: '4px',
              height: '4px',
              background: 'rgba(16, 185, 129, 0.8)',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.4s infinite both',
            }} />
          </div>
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
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
