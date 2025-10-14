import { Github, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

export default function AboutPage() {
  const navigate = useNavigate();
  const version = '1.0.0'; // You can update this with actual version

  return (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text, position: 'relative' }}>
      {/* Geometric elements for depth */}
      <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.06)', top: '-15%', right: '-15%' }} />
      <div style={{ position: 'absolute', width: 180, height: 180, border: '1px solid rgba(255, 255, 255, 0.05)', transform: 'rotate(45deg)', bottom: '20%', left: '10%' }} />
      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.04)', top: '60%', right: '10%' }} />

      {/* Header */}
      <div className="settings-header">
        <button onClick={() => navigate(-1)} className="settings-back" aria-label="Go back">‹</button>
        <div className="settings-header-title">About</div>
      </div>

      {/* Content */}
      <div className="settings-container">
        {/* Hero Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            padding: 8,
            background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
            marginBottom: 16
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: 12,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ color: '#0b0f14', fontWeight: 800, fontSize: 24 }}>S</div>
            </div>
          </div>
          <div style={{ color: '#e5e7eb', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>SwitchAI</div>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>Fast, private, and responsive AI</div>
          <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, maxWidth: 400 }}>
            SwitchAI gives you lightning-fast answers with privacy-first defaults and a clean, distraction-free chat UI.
          </div>
        </div>

        {/* Details Card */}
        <div className="settings-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>App</span>
            <span style={{ color: '#e5e7eb', fontWeight: 700 }}>SwitchAI</span>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Version</span>
            <span style={{ color: '#e5e7eb', fontWeight: 700 }}>{version}</span>
          </div>
        </div>

        {/* Highlights */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>Highlights</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ color: '#fff', fontSize: 16 }}>⚡</div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Instant Responses</span>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ color: '#fff', fontSize: 16 }}>🧠</div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Advanced AI</span>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ color: '#fff', fontSize: 16 }}>🔒</div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Secure</span>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ color: '#fff', fontSize: 16 }}>⚙️</div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Customizable</span>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ color: '#fff', fontSize: 16 }}>🚀</div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>High Performance</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>Links</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => window.open('https://github.com/your-repo', '_blank')}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              <Github size={18} />
              GitHub
            </button>
            <button
              onClick={() => window.open('https://your-website.com', '_blank')}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              <Globe size={18} />
              Website
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 14,
          padding: 18,
          textAlign: 'center'
        }}>
          <div style={{ color: '#cbd5e1', fontSize: 13 }}>
            Built for speed, privacy, and reliability.
          </div>
        </div>
      </div>
    </div>
  );
}