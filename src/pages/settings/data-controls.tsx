import { Archive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function DataControlsPage() {

  const [useForTraining, setUseForTraining] = useState(() => {
    try {
      return localStorage.getItem('useDataForTraining') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Save to localStorage whenever useForTraining changes
    localStorage.setItem('useDataForTraining', useForTraining ? '1' : '0');
  }, [useForTraining]);

  const clearChatStorage = (mode: 'all' | 'active' | 'archived') => {
    try {
      const raw = localStorage.getItem('switchai_chats');
      const list = raw ? JSON.parse(raw) : [];
      const chats = Array.isArray(list) ? list : [];

      let toKeep: any[] = [];
      if (mode === 'all') {
        toKeep = [];
      } else if (mode === 'active') {
        toKeep = chats.filter((c: any) => !!c?.archived);
      } else if (mode === 'archived') {
        toKeep = chats.filter((c: any) => !c?.archived);
      }

      localStorage.setItem('switchai_chats', JSON.stringify(toKeep));

      // Also clear any message storage if it exists
      const msgKeys = chats
        .filter((c: any) => {
          if (mode === 'all') return true;
          if (mode === 'active') return !c?.archived;
          if (mode === 'archived') return !!c?.archived;
          return false;
        })
        .map((c: any) => `switchai_msgs_${c?.id}`)
        .filter(Boolean);

      msgKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch { }
      });

    } catch (error) {
      console.error('Error clearing chat storage:', error);
    }
  };

  const confirmDeleteActive = () => {
    if (confirm('Delete all active chats? Archived chats will be kept. This action cannot be undone.')) {
      clearChatStorage('active');
      alert('All active chats cleared. Archived chats were kept.');
    }
  };

  const confirmDeleteArchived = () => {
    if (confirm('Delete all archived chats? Active chats will be kept. This action cannot be undone.')) {
      clearChatStorage('archived');
      alert('All archived chats cleared. Active chats were kept.');
    }
  };

  return (
    <SettingsLayout title="Data & Privacy" subtitle="Manage your data and privacy settings">
      {/* Privacy Section */}
      <div className="animate-fade-in-up" style={{ marginBottom: 24 }}>
        <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Privacy</div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 20,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Use data for training</div>
            <div style={{ color: '#888888', fontSize: 13 }}>Allow anonymous usage to improve model quality</div>
          </div>
          <input
            type="checkbox"
            checked={useForTraining}
            onChange={(e) => setUseForTraining(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* Danger Zone */}
      <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Danger zone</div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 16,
        }}>
          <button onClick={confirmDeleteActive} style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            color: '#ef4444',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 10,
            transition: 'all 0.2s ease',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}>
            <Trash2 size={18} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Delete Active Chats</div>
              <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2, color: '#fca5a5' }}>Removes all active chats. Archived are kept.</div>
            </div>
          </button>
          <button onClick={confirmDeleteArchived} style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            color: '#ef4444',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}>
            <Archive size={18} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Delete Archived Chats</div>
              <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2, color: '#fca5a5' }}>Removes only archived chats. Active are kept.</div>
            </div>
          </button>
        </div>
      </div>
    </SettingsLayout>
  );
}