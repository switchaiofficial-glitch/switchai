import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg,#000,#050505,#0A0A0A)',
      color: '#fff'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="SwitchAi" style={{ width: 28, height: 28 }} />
          <strong>SwitchAi</strong>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/login')} style={btnGhost}>Login</button>
          <button onClick={() => navigate('/login/signin')} style={btnPrimary}>Get Started</button>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 960, width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', fontSize: 12, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981', display: 'inline-block' }} />
            Live preview
          </div>
          <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: '0 0 12px', letterSpacing: -1, fontWeight: 800 }}>AI that helps you think faster</h1>
          <p style={{ maxWidth: 680, margin: '0 auto', color: 'rgba(255,255,255,0.8)' }}>
            SwitchAi brings multi-model chat, math, and code to the browser. Clean UI. Smooth streaming. Copyable code and beautiful math.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button onClick={() => navigate('/homescreen')} style={btnPrimary}>Open Chat</button>
            <button onClick={() => navigate('/login/signin')} style={btnGhost}>Continue with Google</button>
          </div>

          {/* Features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginTop: 40 }}>
            {[
              { title: 'Fast streaming', desc: 'Low-latency deltas with smooth auto-scroll.' },
              { title: 'Pretty Markdown', desc: 'Headings, tables, and GFM supported.' },
              { title: 'Code blocks', desc: 'Prism highlighting and 1-click copy.' },
              { title: 'KaTeX math', desc: 'Inline and display equations render crisply.' },
            ].map((f) => (
              <div key={f.title} style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ padding: 16, textAlign: 'center', color: 'rgba(255,255,255,0.6)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        © {new Date().getFullYear()} SwitchAi
      </footer>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg,#34d399,#06b6d4)',
  color: '#0b0f14',
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer'
};

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 600,
  cursor: 'pointer'
};
