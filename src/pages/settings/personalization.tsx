import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

export default function PersonalizationPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text, position: 'relative' }}>
      {/* Geometric elements for depth */}
      <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.06)', top: '-15%', right: '-15%' }} />
      <div style={{ position: 'absolute', width: 180, height: 180, border: '1px solid rgba(255, 255, 255, 0.05)', transform: 'rotate(45deg)', bottom: '20%', left: '10%' }} />
      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.04)', top: '60%', right: '10%' }} />

      {/* Header */}
      <div className="settings-header">
        <button onClick={() => navigate(-1)} className="settings-back" aria-label="Go back">‹</button>
        <div className="settings-header-title">Personalization</div>
      </div>

      {/* Content */}
      <div className="settings-container">
        <div className="settings-section">
          <div className="settings-section-title">Personalization</div>
          <div style={{ padding: '16px', color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
            No personalization settings available yet.
          </div>
        </div>
      </div>
    </div>
  );
}