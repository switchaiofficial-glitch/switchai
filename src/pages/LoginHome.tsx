import Lottie from 'lottie-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginHome() {
  const navigate = useNavigate();
  const [appAnim, setAppAnim] = React.useState<any>(null);
  const [getStartedAnim, setGetStartedAnim] = React.useState<any>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  React.useEffect(() => {
    fetch('/animations/app.json').then(r => r.json()).then(setAppAnim).catch(() => {});
    fetch('/animations/getstarted.json').then(r => r.json()).then(setGetStartedAnim).catch(() => {});
  }, []);

  const handleGetStarted = () => {
    setIsTransitioning(true);
    // Delay navigation to allow fade-out animation
    setTimeout(() => {
      navigate('/login/signin');
    }, 300);
  };

  return (
    <div className={`login-home ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
      {/* Background Elements */}
      <div className="login-home-gradient" />
      <div className="login-home-geo1" />
      <div className="login-home-geo2" />
      <div className="login-home-geo3" />

      {/* Main Content */}
      <div className="login-home-main">
        {/* Logo Section */}
        <div className="login-home-logo-section">
          {appAnim && (
            <Lottie
              animationData={appAnim}
              loop
              className="login-home-logo-lottie"
            />
          )}
        </div>

        {/* Content Section */}
        <div className="login-home-content">
          <div className="login-home-branding">
            <h1 className="login-home-title">SwitchAi</h1>
            <p className="login-home-subtitle">AI-Powered Legal Intelligence</p>
          </div>

          {/* CTA Section */}
          <div className="login-home-cta">
            <button
              className="login-home-cta-btn"
              onClick={handleGetStarted}
              aria-label="Get started with SwitchAi"
            >
              <div className="login-home-cta-content">
                <span className="login-home-cta-text">Get Started</span>
                {getStartedAnim && (
                  <Lottie
                    animationData={getStartedAnim}
                    loop
                    className="login-home-cta-lottie"
                  />
                )}
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
