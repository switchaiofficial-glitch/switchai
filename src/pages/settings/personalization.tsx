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

  const [mathLatexEnabled, setMathLatexEnabled] = useState(() => {
    try {
      return localStorage.getItem('mathLatexEnabled') === '1';
    } catch {
      return false;
    }
  });

  const [katexOnlyEnabled, setKatexOnlyEnabled] = useState(() => {
    try {
      return localStorage.getItem('katexOnlyEnabled') === '1';
    } catch {
      return false;
    }
  });

  const [showReasoningMenu, setShowReasoningMenu] = useState(false);

  // Save functions
  const updateReasoningLevel = (level: 'low' | 'medium' | 'high') => {
    setReasoningLevel(level);
    localStorage.setItem('reasoningLevel', level);
  };

  const updateMathLatexSetting = (enabled: boolean) => {
    setMathLatexEnabled(enabled);
    localStorage.setItem('mathLatexEnabled', enabled ? '1' : '0');
  };

  const updateKatexOnly = (enabled: boolean) => {
    setKatexOnlyEnabled(enabled);
    localStorage.setItem('katexOnlyEnabled', enabled ? '1' : '0');
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
        <div style={{ fontSize: 18, fontWeight: 800 }}>Personalization</div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>Models & Display</div>

          {/* Reasoning Effort */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.colors.border}`, borderRadius: 12, padding: '10px 12px', position: 'relative', marginBottom: 12 }}>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 700 }}>Reasoning Effort</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Set effort for reasoning models</div>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowReasoningMenu(v => !v)}
                title="Reasoning level"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '999px',
                  color: theme.colors.text,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
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

          {/* Math LaTeX Rendering */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 12,
            cursor: 'pointer'
          }}>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 700 }}>Math LaTeX Rendering</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Render all formulas with LaTeX</div>
            </div>
            <input
              type="checkbox"
              checked={mathLatexEnabled}
              onChange={(e) => updateMathLatexSetting(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
          </label>

          {/* Use KaTeX Only */}
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
              <div style={{ color: '#e5e7eb', fontWeight: 700 }}>Use KaTeX Only</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Experimental: render ALL math with KaTeX</div>
            </div>
            <input
              type="checkbox"
              checked={katexOnlyEnabled}
              onChange={(e) => updateKatexOnly(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}