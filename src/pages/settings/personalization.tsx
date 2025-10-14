import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

export default function PersonalizationPage() {
  const navigate = useNavigate();

  // State for settings
  const [reasoningLevel, setReasoningLevel] = useState<'low' | 'medium' | 'high'>(() => {
    try {
      const v = localStorage.getItem('reasoningLevel');
      if (v === 'low' || v === 'medium' || v === 'high') return v;
    } catch {}
    return 'medium';
  });

  const [showReasoningMenu, setShowReasoningMenu] = useState(false);

  // Save functions
  const updateReasoningLevel = (level: 'low' | 'medium' | 'high') => {
    setReasoningLevel(level);
    localStorage.setItem('reasoningLevel', level);
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
        <div className="settings-header-title">Personalization</div>
      </div>

      {/* Content */}
      <div className="settings-container">
        <div className="settings-section">
          <div className="settings-section-title">Models & Display</div>

          {/* Reasoning Effort */}
          <div className="settings-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '10px 12px' }}>
            <div>
              <div className="settings-title">Reasoning Effort</div>
              <div className="settings-subtitle">Set effort for reasoning models</div>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowReasoningMenu(v => !v)}
                title="Reasoning level"
                className="btn btn-outline"
                style={{ borderRadius: 999, padding: '8px 12px', fontSize: 12 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.colors.primary, display: 'inline-block' }} />
                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{reasoningLevel}</span>
                <ChevronDown size={14} />
              </button>
              {showReasoningMenu && (
                <div style={{
                  position: 'absolute',
                  top: '42px',
                  right: 0,
                  background: 'rgba(26,28,34,0.98)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 10,
                  padding: 6,
                  minWidth: 160,
                  zIndex: 1000
                }}>
                  {(['low', 'medium', 'high'] as const).map(lvl => (
                    <div
                      key={lvl}
                      onClick={() => {
                        updateReasoningLevel(lvl);
                        setShowReasoningMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: reasoningLevel === lvl ? 'rgba(255,255,255,0.06)' : 'transparent'
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{lvl}</span>
                      {reasoningLevel === lvl && <Check size={14} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Removed KaTeX/LaTeX options as requested */}
        </div>
      </div>
    </div>
  );
}