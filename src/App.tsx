import { auth } from '@/lib/firebase';
import Lottie from 'lottie-react';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen';
import LoginHome from './pages/LoginHome';
import SettingsPage from './pages/Settings';
import SignIn from './pages/SignIn';
import AboutPage from './pages/settings/about';
import AIMemoryPage from './pages/settings/ai-memory';
import DataControlsPage from './pages/settings/data-controls';
import DedicatedInferencePage from './pages/settings/dedicated-inference';
import PersonalizationPage from './pages/settings/personalization';
import StatusPage from './pages/settings/status';
import TokensPage from './pages/settings/tokens';
import './styles/animations.css';

export default function App() {
  const [user, setUser] = React.useState<any | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [appAnimation, setAppAnimation] = React.useState<any>(null);

  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Load app.json Lottie animation
  React.useEffect(() => {
    const loadAnimation = async () => {
      try {
        const response = await fetch('/animations/app.json');
        const data = await response.json();
        setAppAnimation(data);
      } catch (error) {
        console.warn('Failed to load app animation:', error);
      }
    };
    loadAnimation();
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
        background: '#212121',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        {/* Main content */}
        <div className="animate-fade-in-up" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Logo with scale animation */}
          <div className="animate-scale-in" style={{
            marginBottom: '32px',
          }}>
            {appAnimation && (
              <Lottie
                animationData={appAnimation}
                loop={true}
                autoplay={true}
                style={{ width: 80, height: 80 }}
              />
            )}
          </div>

          {/* Brand text */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '400',
              color: '#ffffff',
              margin: '0 0 8px 0',
              letterSpacing: '-0.5px',
            }}>
              SwitchAi
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#ffffff',
              margin: 0,
              fontWeight: 400,
            }}>
              Initializing your experience...
            </p>
          </div>

          {/* Loading indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              background: '#ffffff',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out infinite both',
            }} />
            <div style={{
              width: '10px',
              height: '10px',
              background: '#ffffff',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.2s infinite both',
            }} />
            <div style={{
              width: '10px',
              height: '10px',
              background: '#ffffff',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.4s infinite both',
            }} />
          </div>
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
      <Route path="/settings/tokens" element={<RequireAuth><TokensPage /></RequireAuth>} />
      <Route path="/settings/personalization" element={<RequireAuth><PersonalizationPage /></RequireAuth>} />
      <Route path="/settings/ai-memory" element={<RequireAuth><AIMemoryPage /></RequireAuth>} />
      <Route path="/settings/data-controls" element={<RequireAuth><DataControlsPage /></RequireAuth>} />
      <Route path="/settings/dedicated-inference" element={<RequireAuth><DedicatedInferencePage /></RequireAuth>} />
      <Route path="/settings/status" element={<RequireAuth><StatusPage /></RequireAuth>} />
      <Route path="/settings/about" element={<RequireAuth><AboutPage /></RequireAuth>} />

      {/* Fallback to appropriate entry based on auth */}
      <Route path="*" element={<Navigate to={user ? '/homescreen' : '/login'} replace />} />
    </Routes>
  );
}
