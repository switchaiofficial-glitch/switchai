import { auth } from '@/lib/firebase';
import { Brain, ChevronLeft, Database, Info, LogOut, Mail, Phone, Rocket, Server, User } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';
import '../styles/animations.css';

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const name = user?.displayName || 'User';
  const email = user?.email || 'Not signed in';
  const phone = user?.phoneNumber || 'Not set';
  const photoURL = user?.photoURL || '';
  const [avatarError, setAvatarError] = React.useState(false);

  const signOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        await auth.signOut();
        navigate('/login');
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
  };

  const SettingRow = ({ icon, title, subtitle, onClick, badge, index }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
    badge?: string;
    index?: number;
  }) => (
    <div
      className="animate-fade-in-up"
      onClick={onClick}
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        animationDelay: `${(index || 0) * 50}ms`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px) scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#ffffff',
          marginBottom: 3,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 13,
          color: '#666666',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {subtitle}
        </div>
      </div>
      {badge && (
        <div style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: '#10b981',
          fontSize: 11,
          fontWeight: 700,
          color: '#000000',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {badge}
        </div>
      )}
      <div style={{ color: '#444444' }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#000000',
      color: '#ffffff',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#000000',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#ffffff' }}>Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Profile Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {photoURL && !avatarError ? (
                <img
                  src={photoURL}
                  alt={name}
                  onError={() => setAvatarError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
                  {(name[0] || 'U').toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px 0', color: '#ffffff' }}>
                {name}
              </h2>
              <div style={{ fontSize: 14, color: '#666666' }}>{email}</div>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SettingRow
            index={0}
            icon={<Rocket size={20} />}
            title="Tokens"
            subtitle="View your token balance and usage"
            onClick={() => navigate('/settings/tokens')}
          />

          <SettingRow
            index={1}
            icon={<Brain size={20} />}
            title="Personalization"
            subtitle="Customize your experience"
            onClick={() => navigate('/settings/personalization')}
          />

          <SettingRow
            index={2}
            icon={<Brain size={20} />}
            title="AI Memory"
            subtitle="Manage personalized context"
            onClick={() => navigate('/settings/ai-memory')}
            badge="New"
          />

          <SettingRow
            index={3}
            icon={<Database size={20} />}
            title="Data Controls"
            subtitle="Privacy and local data management"
            onClick={() => navigate('/settings/data-controls')}
          />

          <SettingRow
            index={4}
            icon={<Rocket size={20} />}
            title="Dedicated Inference"
            subtitle="Use your own API keys"
            onClick={() => navigate('/settings/dedicated-inference')}
          />

          <SettingRow
            index={5}
            icon={<Server size={20} />}
            title="Server Status"
            subtitle="Infrastructure monitoring"
            onClick={() => navigate('/settings/status')}
          />

          <SettingRow
            index={6}
            icon={<Info size={20} />}
            title="About"
            subtitle="App version and information"
            onClick={() => navigate('/settings/about')}
          />
        </div>

        {/* Sign Out Button */}
        <div className="animate-fade-in-up" style={{ marginTop: 24, animationDelay: '350ms' }}>
          <button
            onClick={signOut}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              color: '#ef4444',
              fontSize: 15,
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
