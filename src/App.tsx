import { auth } from '@/lib/firebase';
import Lottie from 'lottie-react';
import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen';
import LoginHome from './pages/LoginHome';
import SignIn from './pages/SignIn';

import './styles/animations.css';

import MobileRedirect from './pages/MobileRedirect';

export default function App() {
  const [user, setUser] = React.useState<any | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [appAnimation, setAppAnimation] = React.useState<any>(null);
  const [isPhone, setIsPhone] = React.useState(false);

  React.useEffect(() => {
    // Check mobile/tablet status
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent.toLowerCase());
      return isMobile && !isTablet;
    };
    setIsPhone(checkMobile());
  }, []);

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

  if (isPhone) {
    return <MobileRedirect onContinue={() => setIsPhone(false)} />;
  }

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
    <>
      <Routes>
        {/* Root redirects based on auth state */}
        <Route path="/" element={<Navigate to={user ? '/homescreen' : '/login'} replace />} />

        {/* Auth flow: show only if not logged in */}
        <Route path="/login" element={<RedirectIfAuthed><LoginHome /></RedirectIfAuthed>} />
        <Route path="/login/signin" element={<RedirectIfAuthed><SignIn /></RedirectIfAuthed>} />

        {/* Protected area */}
        <Route path="/homescreen" element={<RequireAuth><HomeScreen /></RequireAuth>} />


        {/* Fallback to appropriate entry based on auth */}
        <Route path="*" element={<Navigate to={user ? '/homescreen' : '/login'} replace />} />
      </Routes>
      <Toaster
        position="top-right"
        containerStyle={{
          top: 10,
        }}
        toastOptions={{
          // Default styling for all toasts
          style: {
            background: 'rgba(30, 30, 30, 0.95)',
            color: '#ffffff',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '14px 18px',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            maxWidth: '400px',
          },
          duration: 3000,
          // Success toast styling
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          // Error toast styling
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
          // Loading toast styling
          loading: {
            iconTheme: {
              primary: '#3b82f6',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </>
  );
}
