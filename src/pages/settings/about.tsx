import { Github, Globe, Zap, Shield, Brain, Rocket, Heart } from 'lucide-react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function AboutPage() {
  const version = '1.0.0';

  return (
    <SettingsLayout title="About" subtitle="Learn more about SwitchAI">
      {/* Hero Section */}
      <div className="animate-fade-in-up" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        textAlign: 'center', 
        marginBottom: 32,
        padding: '24px 20px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 20,
          padding: 12,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img src="/app.png" alt="SwitchAI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ color: '#ffffff', fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: '-1px' }}>SwitchAI</div>
        <div style={{ color: '#888888', fontSize: 15, marginBottom: 16, fontWeight: 600 }}>Fast, Private, Intelligent</div>
        <div style={{ color: '#666666', fontSize: 14, lineHeight: 1.7, maxWidth: 420 }}>
          SwitchAI delivers lightning-fast AI responses with privacy-first defaults and a clean, distraction-free interface designed for productivity.
        </div>
      </div>

      {/* Details Card */}
      <div className="animate-fade-in-up" style={{ 
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        animationDelay: '100ms',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: '#888888', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Application</span>
          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>SwitchAI</span>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 14 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#888888', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Version</span>
          <span style={{ 
            color: '#10b981', 
            fontWeight: 700, 
            fontSize: 15,
            padding: '4px 10px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 6,
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}>{version}</span>
        </div>
      </div>

      {/* Features */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Features</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { icon: <Zap size={20} />, text: 'Lightning Fast', color: '#f59e0b', delay: '150ms' },
            { icon: <Brain size={20} />, text: 'Advanced AI', color: '#a78bfa', delay: '200ms' },
            { icon: <Shield size={20} />, text: 'Privacy First', color: '#10b981', delay: '250ms' },
            { icon: <Rocket size={20} />, text: 'High Performance', color: '#3b82f6', delay: '300ms' },
          ].map((feature, i) => (
            <div key={i} className="animate-fade-in-up" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.3s ease',
              animationDelay: feature.delay,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = feature.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}>
              <div style={{ color: feature.color }}>{feature.icon}</div>
              <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 700 }}>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="animate-fade-in-up" style={{ marginBottom: 24, animationDelay: '350ms' }}>
        <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Connect</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => window.open('https://github.com/your-repo', '_blank')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 20px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Github size={18} />
            GitHub
          </button>
          <button
            onClick={() => window.open('https://your-website.com', '_blank')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 20px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Globe size={18} />
            Website
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="animate-fade-in-up" style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        padding: 20,
        textAlign: 'center',
        animationDelay: '400ms',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#888888', fontSize: 14 }}>
          <span>Made with</span>
          <Heart size={14} color="#ef4444" fill="#ef4444" />
          <span>for AI enthusiasts</span>
        </div>
      </div>
    </SettingsLayout>
  );
}