import { auth } from '@/lib/firebase';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen';
import LoginHome from './pages/LoginHome';
import SettingsPage from './pages/Settings';
import SignIn from './pages/SignIn';

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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#ffffff',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '15px',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
          marginBottom: '20px',
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
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#f3f4f6',
          marginBottom: '8px',
        }}>
          SwitchAi
        </div>
        <div style={{
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          Initializing...
        </div>
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

      {/* Fallback to appropriate entry based on auth */}
      <Route path="*" element={<Navigate to={user ? '/homescreen' : '/login'} replace />} />
    </Routes>
  );
}
