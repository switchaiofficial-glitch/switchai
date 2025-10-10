import { Check, ExternalLink, Eye, EyeOff, Key } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

interface ProviderCardProps {
  title: 'Groq' | 'OpenRouter' | 'Cerebras';
  value: string;
  setValue: (value: string) => void;
  enabled: boolean;
  hasKey: boolean;
  setEnabled: (enabled: boolean) => void;
  looksValid: boolean;
  docsUrl: string;
  placeholder: string;
}

function ProviderCard({
  title,
  value,
  setValue,
  enabled,
  hasKey,
  setEnabled,
  looksValid,
  docsUrl,
  placeholder
}: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      alert(`Please paste a valid ${title} API key.`);
      return;
    }
    if (!looksValid) {
      alert(`Please enter a valid ${title} API key.`);
      return;
    }

    setSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem(`${title.toLowerCase()}_api_key`, trimmed);
      localStorage.setItem(`${title.toLowerCase()}_enabled`, 'true');
      setEnabled(true);
      alert(`Your ${title} key is saved.`);
    } catch (e) {
      alert(`Failed to save your ${title} key. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const onToggle = (next: boolean) => {
    if (next && !hasKey) {
      alert(`Please add your ${title} API key before enabling.`);
      return;
    }
    setEnabled(next);
    localStorage.setItem(`${title.toLowerCase()}_enabled`, next ? 'true' : 'false');
  };

  return (
    <div style={{
      background: 'rgba(11, 15, 20, 0.7)',
      borderRadius: 16,
      padding: 16,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Key size={16} />
          </div>
          <div>
            <div style={{ color: '#e5e7eb', fontWeight: 800 }}>{title}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Use your own {title} API key</div>
          </div>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 999,
          background: enabled ? '#a5f3fc' : 'rgba(148,163,184,0.18)',
          border: `1px solid ${enabled ? 'rgba(165,243,252,0.8)' : 'rgba(148,163,184,0.35)'}`
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: enabled ? '#0b0f14' : '#cbd5e1'
          }} />
          <span style={{
            color: enabled ? '#0b0f14' : '#cbd5e1',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: 0.5
          }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${looksValid ? theme.colors.border : 'rgba(239,68,68,0.5)'}`,
              borderRadius: 8,
              padding: '10px 40px 10px 12px',
              color: '#e5e7eb',
              fontSize: 14,
              outline: 'none'
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4
            }}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ color: '#cbd5e1', fontSize: 12 }}>Enable {title}</span>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.open(docsUrl, '_blank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#93c5fd',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <ExternalLink size={12} />
            Docs
          </button>

          <button
            onClick={onSave}
            disabled={saving || !looksValid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: looksValid ? '#10b981' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${looksValid ? 'rgba(16,185,129,0.5)' : theme.colors.border}`,
              color: looksValid ? '#fff' : '#94a3b8',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: looksValid ? 'pointer' : 'not-allowed',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : hasKey ? 'Update' : 'Save'}
            {!saving && <Check size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DedicatedInferencePage() {
  const navigate = useNavigate();

  // Groq state
  const [groqKey, setGroqKey] = useState('');
  const [groqEnabled, setGroqEnabled] = useState(false);
  const [groqHasKey, setGroqHasKey] = useState(false);
  const groqLooksValid = /^gsk_[A-Za-z0-9]/.test(String(groqKey || '').trim());

  // OpenRouter state
  const [orKey, setOrKey] = useState('');
  const [orEnabled, setOrEnabled] = useState(false);
  const [orHasKey, setOrHasKey] = useState(false);
  const orLooksValid = /^(sk|or)-[A-Za-z0-9]/.test(String(orKey || '').trim());

  // Cerebras state
  const [cbKey, setCbKey] = useState('');
  const [cbEnabled, setCbEnabled] = useState(false);
  const [cbHasKey, setCbHasKey] = useState(false);
  const cbLooksValid = /^csk-[A-Za-z0-9_-]{8,}$/.test(String(cbKey || '').trim());

  useEffect(() => {
    // Load saved keys and settings
    try {
      const groqSaved = localStorage.getItem('groq_api_key');
      const groqEnabledSaved = localStorage.getItem('groq_enabled') === 'true';
      if (groqSaved) {
        setGroqKey(groqSaved);
        setGroqHasKey(true);
        setGroqEnabled(groqEnabledSaved);
      }

      const orSaved = localStorage.getItem('openrouter_api_key');
      const orEnabledSaved = localStorage.getItem('openrouter_enabled') === 'true';
      if (orSaved) {
        setOrKey(orSaved);
        setOrHasKey(true);
        setOrEnabled(orEnabledSaved);
      }

      const cbSaved = localStorage.getItem('cerebras_api_key');
      const cbEnabledSaved = localStorage.getItem('cerebras_enabled') === 'true';
      if (cbSaved) {
        setCbKey(cbSaved);
        setCbHasKey(true);
        setCbEnabled(cbEnabledSaved);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  }, []);

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
        <div style={{ fontSize: 18, fontWeight: 800 }}>Dedicated Inference</div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>
            API Keys
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 20 }}>
            Use your own API keys for dedicated inference. Keys are stored locally in your browser.
          </div>

          <ProviderCard
            title="Groq"
            value={groqKey}
            setValue={setGroqKey}
            enabled={groqEnabled}
            hasKey={groqHasKey}
            setEnabled={setGroqEnabled}
            looksValid={groqLooksValid}
            docsUrl="https://console.groq.com/keys"
            placeholder="gsk_..."
          />

          <ProviderCard
            title="OpenRouter"
            value={orKey}
            setValue={setOrKey}
            enabled={orEnabled}
            hasKey={orHasKey}
            setEnabled={setOrEnabled}
            looksValid={orLooksValid}
            docsUrl="https://openrouter.ai/keys"
            placeholder="sk-or-v1-..."
          />

          <ProviderCard
            title="Cerebras"
            value={cbKey}
            setValue={setCbKey}
            enabled={cbEnabled}
            hasKey={cbHasKey}
            setEnabled={setCbEnabled}
            looksValid={cbLooksValid}
            docsUrl="https://inference.cerebras.ai/"
            placeholder="csk-..."
          />
        </div>
      </div>
    </div>
  );
}