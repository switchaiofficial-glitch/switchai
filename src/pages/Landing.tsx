import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landing-gradient"></div>
      <div className="landing-geo1"></div>
      <div className="landing-geo2"></div>
      <div className="landing-geo3"></div>

      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-content">
          <div className="landing-logo">
            <img src="/logo.png" alt="SwitchAi" className="landing-logo-img" />
            <strong className="landing-logo-text">SwitchAi</strong>
          </div>
          <nav className="landing-nav">
            <button onClick={() => navigate('/login')} className="landing-btn-ghost">Login</button>
            <button onClick={() => navigate('/login/signin')} className="landing-btn-primary">Get Started</button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="landing-main">
        <div className="landing-hero">
          <div className="landing-status">
            <span className="landing-status-dot"></span>
            Live preview
          </div>
          <h1 className="landing-title">AI that helps you think faster</h1>
          <p className="landing-subtitle">
            SwitchAi brings multi-model chat, math, and code to the browser. Clean UI. Smooth streaming. Copyable code and beautiful math.
          </p>

          <div className="landing-cta">
            <button onClick={() => navigate('/homescreen')} className="landing-btn-primary">Open Chat</button>
            <button onClick={() => navigate('/login/signin')} className="landing-btn-ghost">Continue with Google</button>
          </div>

          {/* Features */}
          <div className="landing-features">
            {[
              { title: 'Fast streaming', desc: 'Low-latency deltas with smooth auto-scroll.' },
              { title: 'Pretty Markdown', desc: 'Headings, tables, and GFM supported.' },
              { title: 'Code blocks', desc: 'Prism highlighting and 1-click copy.' },
              { title: 'KaTeX math', desc: 'Inline and display equations render crisply.' },
            ].map((f) => (
              <div key={f.title} className="landing-feature">
                <div className="landing-feature-title">{f.title}</div>
                <div className="landing-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        © {new Date().getFullYear()} SwitchAi
      </footer>
    </div>
  );
}
