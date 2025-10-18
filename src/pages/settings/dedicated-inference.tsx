import { Check, ExternalLink, Eye, EyeOff, Key, AlertCircle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

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
  placeholder,
  index
}: ProviderCardProps & { index?: number }) {
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
    <div className="animate-fade-in-up" style={{ 
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      padding: 20,
      marginBottom: 12,
      transition: 'all 0.3s ease',
      animationDelay: `${(index || 0) * 100}ms`,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Key size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{title}</div>
            <div style={{ color: '#666666', fontSize: 13 }}>Use your own {title} API key</div>
          </div>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: enabled ? '#10b981' : 'rgba(255, 255, 255, 0.04)',
          border: `1px solid ${enabled ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
          transition: 'all 0.2s ease',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: enabled ? '#000000' : '#666666'
          }} />
          <span style={{
            color: enabled ? '#000000' : '#666666',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            {enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', color: '#888888', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          API Key
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: '12px 44px 12px 16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${!value ? 'rgba(255, 255, 255, 0.08)' : looksValid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
              borderRadius: 10,
              color: '#ffffff',
              fontSize: 14,
              fontFamily: 'monospace',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.borderColor = !value ? 'rgba(255, 255, 255, 0.08)' : looksValid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              color: '#888888',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#888888';
            }}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {value && !looksValid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#ef4444', fontSize: 12 }}>
            <AlertCircle size={14} />
            <span>Invalid API key format</span>
          </div>
        )}
        {value && looksValid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#10b981', fontSize: 12 }}>
            <Check size={14} />
            <span>Valid API key format</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10, 
          cursor: 'pointer',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
        }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            style={{ 
              width: 18, 
              height: 18,
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 600 }}>Enable {title}</span>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.open(docsUrl, '_blank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <ExternalLink size={14} />
            Docs
          </button>

          <button
            onClick={onSave}
            disabled={saving || !looksValid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: (saving || !looksValid) ? 'rgba(16, 185, 129, 0.3)' : '#10b981',
              border: 'none',
              borderRadius: 8,
              color: (saving || !looksValid) ? '#888888' : '#000000',
              fontSize: 13,
              fontWeight: 700,
              cursor: (saving || !looksValid) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (saving || !looksValid) ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!saving && looksValid) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {saving ? 'Saving...' : hasKey ? 'Update Key' : 'Save Key'}
            {!saving && <Check size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DedicatedInferencePage() {

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
    <SettingsLayout title="Dedicated Inference" subtitle="Use your own API keys for inference">
      {/* Info card */}
      <div className="animate-fade-in-up" style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sparkles size={20} color="#10b981" />
        </div>
        <div>
          <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Secure & Private</div>
          <div style={{ color: '#888888', fontSize: 13, lineHeight: 1.6 }}>
            Your API keys are stored locally in your browser and never sent to our servers. Enable dedicated inference to use your own keys for unlimited access.
          </div>
        </div>
      </div>

      {/* Provider cards */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>
          API Providers
        </div>

        <ProviderCard
          index={0}
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
          index={1}
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
          index={2}
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
    </SettingsLayout>
  );
}