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
      <div className="settings-header">
        <button onClick={() => navigate(-1)} className="settings-back" aria-label="Go back">‹</button>
        <div className="settings-header-title">Data & Privacy</div>
      </div>

      {/* Content */}
      <div className="settings-container">
        {/* Privacy Section */}
        <div className="settings-section">
          <div className="settings-section-title">Privacy</div>
          <label className="settings-row settings-card" style={{ cursor: 'pointer' }}>
            <div>
              <div className="settings-title">Use data for training</div>
              <div className="settings-subtitle">Allow anonymous usage to improve model quality</div>
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
        <div className="settings-section">
          <div className="settings-section-title">Danger zone</div>
          <div className="settings-card" style={{ padding: 16 }}>
            <button onClick={confirmDeleteActive} className="btn btn-danger" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 10 }}>
              <Trash2 size={18} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div>Delete Active Chats</div>
                <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2 }}>Removes all active chats. Archived are kept.</div>
              </div>
            </button>
            <button onClick={confirmDeleteArchived} className="btn btn-danger" style={{ width: '100%', justifyContent: 'flex-start' }}>
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