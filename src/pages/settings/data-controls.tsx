import { Archive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

export default function DataControlsPage() {
  const navigate = useNavigate();

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
        } catch {}
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
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text, position: 'relative' }}>
      {/* Geometric elements for depth */}
      <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.06)', top: '-15%', right: '-15%' }} />
      <div style={{ position: 'absolute', width: 180, height: 180, border: '1px solid rgba(255, 255, 255, 0.05)', transform: 'rotate(45deg)', bottom: '20%', left: '10%' }} />
      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.04)', top: '60%', right: '10%' }} />

      {/* Header */}
      <div style={{ height: 60, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          ‹
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Data & Privacy</div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        {/* Privacy Section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>Privacy</div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            cursor: 'pointer'
          }}>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 700 }}>Use data for training</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Allow anonymous usage to improve model quality</div>
            </div>
            <input
              type="checkbox"
              checked={useForTraining}
              onChange={(e) => setUseForTraining(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
          </label>
        </div>

        {/* Danger Zone */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>Danger zone</div>

          <div style={{ background: 'rgba(253, 164, 175, 0.08)', borderRadius: 16, border: '1px solid rgba(253, 164, 175, 0.24)', padding: 16 }}>
            <button
              onClick={confirmDeleteActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                borderRadius: 12,
                padding: '12px 16px',
                fontWeight: 800,
                cursor: 'pointer',
                marginBottom: 10
              }}
            >
              <Trash2 size={18} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div>Delete Active Chats</div>
                <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2 }}>Removes all active chats. Archived are kept.</div>
              </div>
            </button>

            <button
              onClick={confirmDeleteArchived}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                borderRadius: 12,
                padding: '12px 16px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <Archive size={18} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div>Delete Archived Chats</div>
                <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2 }}>Removes only archived chats. Active are kept.</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}