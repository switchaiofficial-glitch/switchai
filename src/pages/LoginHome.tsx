import React from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';

export default function LoginHome() {
  const navigate = useNavigate();
  const [switchAiAnim, setSwitchAiAnim] = React.useState<any>(null);
  const [getStartedAnim, setGetStartedAnim] = React.useState<any>(null);

  React.useEffect(() => {
    fetch('/animations/switchai.json').then(r => r.json()).then(setSwitchAiAnim).catch(() => {});
    fetch('/animations/getstarted.json').then(r => r.json()).then(setGetStartedAnim).catch(() => {});
  }, []);

  return (
    <div className="container">
      <div className="gradient" />
      <div className="geo1" />
      <div className="geo2" />
      <div className="geo3" />

      <div className="center">
        <div style={{ opacity: 1, transform: 'scale(1)', marginBottom: 70 }}>
          {switchAiAnim && (
            <Lottie animationData={switchAiAnim} loop className="logoLottie" />
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 className="title" style={{ fontSize: 64, margin: 0, fontFamily: 'VarelaRound_400Regular, Varela Round, Inter, sans-serif' }}>SwitchAi</h1>
          <p className="subtitle" style={{ fontFamily: 'SUSE_400Regular, Inter, sans-serif' }}>AI-Powered Legal Intelligence</p>
        </div>

        <div className="cta">
          <button
            className="btn"
            onClick={() => navigate('/login/signin')}
          >
            <div className="btnGradient">
              <span className="btnText" style={{ fontFamily: 'SUSE_600SemiBold, Inter, sans-serif' }}>Get Started</span>
              {getStartedAnim && (
                <Lottie animationData={getStartedAnim} loop className="btnLottie" />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
