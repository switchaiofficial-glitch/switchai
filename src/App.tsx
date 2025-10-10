import { auth } from '@/lib/firebase';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen';
import LoginHome from './pages/LoginHome';
import SettingsPage from './pages/Settings';
import SignIn from './pages/SignIn';

export default function App() {
  const [user, setUser] = React.useState<any | null>(auth.currentUser);

  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
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
