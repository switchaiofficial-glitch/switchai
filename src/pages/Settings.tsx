import { auth } from '@/lib/firebase';
import { Brain, ChevronLeft, Database, Info, LogOut, Mail, Rocket, Server } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/animations.css';

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const name = user?.displayName || 'User';
  const email = user?.email || 'Not signed in';
  const photoURL = user?.photoURL || '';
  const [avatarError, setAvatarError] = React.useState(false);

  const fadeAnim = React.useRef(0);
  const scaleAnim = React.useRef(0.85);

  React.useEffect(() => {
    fadeAnim.current = 1;
    scaleAnim.current = 1;
  }, []);

  const initials = (user?.displayName || 'U')
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const signOut = async () => {
    if (confirm('Are you sure you want to sign out of your account?')) {
      try {
        await auth.signOut();
        navigate('/login');
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
  };

  const SettingRow = ({ icon, title, subtitle, onClick }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
  }) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.9';
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{ width: 24, color: '#cbd5e1' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ color: '#64748b' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );

  const SectionTitle = ({ children }: { children: string }) => (
    <div style={{
      color: '#cbd5e1',
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: '0.4px',
      marginBottom: 8,
    }}>
      {children}
    </div>
  );

  return (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      background: '#000000',
      color: '#ffffff',
      overflow: 'hidden',
    }}>
      {/* Geometric decorative elements */}
      <div style={{
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        top: '-15%',
        right: '-15%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 180,
        height: 180,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transform: 'rotate(45deg)',
        bottom: '20%',
        left: '10%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        border: '1px solid rgba(255, 255, 255, 0.04)',
        top: '60%',
        right: '10%',
        pointerEvents: 'none',
      }} />

      {/* Header with gradient overlay */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'transparent',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 16px 12px',
          position: 'relative',
        }}>
          <button
            onClick={() => navigate('/homescreen')}
            style={{
              position: 'absolute',
              left: 16,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 style={{
            color: '#e5e7eb',
            fontSize: 20,
            fontWeight: 800,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
            letterSpacing: '0.3px',
            margin: 0,
          }}>
            Settings
          </h1>
        </div>

        {/* Header fade overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7), transparent)',
          pointerEvents: 'none',
          zIndex: -1,
        }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        padding: '0 16px 120px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div className="animate-fade-in-up" style={{
          maxWidth: 900,
          margin: '0 auto',
          opacity: fadeAnim.current,
          transform: `scale(${scaleAnim.current})`,
          transition: 'all 0.6s ease',
        }}>
          {/* Profile Card */}
          <div style={{
            background: '#000000',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            marginTop: 24,
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              {photoURL && !avatarError ? (
                <img
                  src={photoURL}
                  alt={name}
                  onError={() => setAvatarError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: '#e5e7eb', fontWeight: 800, fontSize: 28 }}>
                  {initials}
                </span>
              )}
            </div>
            <h2 style={{
              color: '#e5e7eb',
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: '0.3px',
              margin: 0,
              textAlign: 'center',
            }}>
              {name.toUpperCase()}
            </h2>
            <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>{email}</div>
          </div>

          {/* Settings Sections */}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Account Section */}
            <div>
              <SectionTitle>Account</SectionTitle>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
              }}>
                <SettingRow
                  icon={<Mail size={20} />}
                  title="Email"
                  subtitle={email}
                  onClick={() => { }}
                />
              </div>
            </div>

            {/* My SwitchAi Section */}
            <div>
              <SectionTitle>My SwitchAi</SectionTitle>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
              }}>
                <SettingRow
                  icon={<Brain size={20} />}
                  title="Personalization"
                  subtitle="Models and preferences"
                  onClick={() => navigate('/settings/personalization')}
                />
                <div style={{ height: 0.5, background: 'rgba(255, 255, 255, 0.08)', marginLeft: 44 }} />
                <SettingRow
                  icon={<Database size={20} />}
                  title="Data Controls"
                  subtitle="Manage your data and privacy"
                  onClick={() => navigate('/settings/data-controls')}
                />
              </div>
            </div>

            {/* Tokens & Rewards Section */}
            <div>
              <SectionTitle>Tokens & Rewards</SectionTitle>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
              }}>
                <SettingRow
                  icon={<Rocket size={20} />}
                  title="Tokens"
                  subtitle="View balance and earn more"
                  onClick={() => navigate('/settings/tokens')}
                />
              </div>
            </div>

            {/* Customization Section */}
            <div>
              <SectionTitle>Customization</SectionTitle>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
              }}>
                <SettingRow
                  icon={<Rocket size={20} />}
                  title="Dedicated Inference"
                  subtitle="Use your own Groq API key"
                  onClick={() => navigate('/settings/dedicated-inference')}
                />
                <div style={{ height: 0.5, background: 'rgba(255, 255, 255, 0.08)', marginLeft: 44 }} />
                <SettingRow
                  icon={<Brain size={20} />}
                  title="AI Memory"
                  subtitle="Manage personalized context"
                  onClick={() => navigate('/settings/ai-memory')}
                />
              </div>
            </div>

            {/* App Section */}
            <div>
              <SectionTitle>App</SectionTitle>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
              }}>
                <SettingRow
                  icon={<Server size={20} />}
                  title="Server Status"
                  subtitle="Infrastructure monitoring"
                  onClick={() => navigate('/settings/status')}
                />
                <div style={{ height: 0.5, background: 'rgba(255, 255, 255, 0.08)', marginLeft: 44 }} />
                <SettingRow
                  icon={<Info size={20} />}
                  title="About"
                  subtitle="App version and information"
                  onClick={() => navigate('/settings/about')}
                />
              </div>
            </div>

            {/* Logout Section */}
            <div style={{ marginTop: 16, marginBottom: 40 }}>
              <div style={{
                background: 'rgba(253, 164, 175, 0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '0.5px solid rgba(253, 164, 175, 0.24)',
              }}>
                <button
                  onClick={signOut}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div style={{
                    position: 'relative',
                    padding: '10px',
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.14), rgba(244, 63, 94, 0.08))',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px',
                    }}>
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(244, 63, 94, 0.12)',
                        border: '0.5px solid rgba(244, 63, 94, 0.32)',
                      }}>
                        <LogOut size={20} color="#fecdd3" />
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ color: '#fecdd3', fontWeight: 700 }}>Logout</div>
                        <div style={{ color: 'rgba(254, 205, 211, 0.8)', fontSize: 11, marginTop: 2 }}>
                          End your current session
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
