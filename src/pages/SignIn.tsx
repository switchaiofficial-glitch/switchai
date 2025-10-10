import React from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

export default function SignIn() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showTerms, setShowTerms] = React.useState(false);

  const [welcomeAnim, setWelcomeAnim] = React.useState<any>(null);
  const [googleAnim, setGoogleAnim] = React.useState<any>(null);
  const [googleLoadingAnim, setGoogleLoadingAnim] = React.useState<any>(null);

  React.useEffect(() => {
    fetch('/animations/welcometext.json').then(r => r.json()).then(setWelcomeAnim).catch(() => {});
    fetch('/animations/google.json').then(r => r.json()).then(setGoogleAnim).catch(() => {});
    fetch('/animations/googleloading.json').then(r => r.json()).then(setGoogleLoadingAnim).catch(() => {});
  }, []);

  const handleGoogle = async () => {
    if (!acceptedTerms) {
      window.alert('Please accept the Terms and Conditions to continue.');
      return;
    }
    setIsLoading(true);
    try {
      // Set persistence based on Remember Me before signing in
      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch {}
      const cred = await signInWithPopup(auth, googleProvider);
      if (rememberMe) {
        try { localStorage.setItem('uid', cred.user.uid); } catch {}
      }
      navigate('/homescreen', { replace: true });
    } catch (e: any) {
      let msg = 'Google sign-in failed';
      if (typeof e?.message === 'string') msg += `: ${e.message}`;
      window.alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="gradient" />
      <div className="geo1" />
      <div className="geo2" />
      <div className="geo3" />

      <div className="center" style={{ width: '100%' }}>
        <div className="header">
          <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 0, color: '#9CA3AF', cursor: 'pointer' }}>&larr;</button>
          <div className="headerTitle" style={{ fontFamily: 'SUSE_600SemiBold, Inter, sans-serif' }}>Sign in</div>
          <div style={{ width: 24 }} />
        </div>

        <div className="contentCard">
          {welcomeAnim && (
            <Lottie animationData={welcomeAnim} loop className="welcomeLottie" />
          )}

          <div className="bottomHalf">
            <div className="bottomInner">
              <div className="siTitle" style={{ fontFamily: 'VarelaRound_400Regular, Varela Round, Inter, sans-serif' }}>Welcome back</div>
              <div className="siSubtitle" style={{ fontFamily: 'SUSE_400Regular, Inter, sans-serif' }}>
                Continue with Google to get started
              </div>

              <div className="googleWrap">
                <div className="googleGlass">
                  <button className="googleBtn" onClick={handleGoogle} disabled={isLoading} style={{ width: '100%', border: 0, background: '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      <Lottie animationData={isLoading ? googleLoadingAnim : googleAnim} loop className="googleLottie" />
                      {!isLoading && (
                        <span className="googleText" style={{ fontFamily: 'SUSE_600SemiBold, Inter, sans-serif' }}>
                          Continue with Google
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              <div className="termsRow">
                <div className={`checkbox ${acceptedTerms ? 'checked' : ''}`} onClick={() => setAcceptedTerms(v => !v)}>
                  {acceptedTerms && <div className="tick" />}
                </div>
                <span className="termsText" style={{ fontFamily: 'SUSE_400Regular, Inter, sans-serif' }}>I accept the Terms & Conditions</span>
                <span className="termsLink" onClick={() => setShowTerms(true)} style={{ fontFamily: 'SUSE_600SemiBold, Inter, sans-serif' }}>View terms</span>
              </div>

              <div className="termsRow" style={{ marginTop: 10 }}>
                <div className={`checkbox ${rememberMe ? 'checked' : ''}`} onClick={() => setRememberMe(v => !v)}>
                  {rememberMe && <div className="tick" />}
                </div>
                <span className="termsText" style={{ fontFamily: 'SUSE_400Regular, Inter, sans-serif' }}>Remember me on this device</span>
              </div>

              <div className="safetyRow">
                <span role="img" aria-label="lock">🔒</span>
                <span>Your data is protected with Google OAuth</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTerms && (
        <div className="modalBackdrop" onClick={() => setShowTerms(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div style={{ fontWeight: 700 }}>Terms & Conditions</div>
              <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Please review before continuing</div>
            </div>
            <div className="modalBody" style={{ color: 'rgba(255,255,255,0.85)' }}>
              <p>Welcome to SwitchAi. By using this app, you agree to the following terms. SwitchAi provides AI-powered assistance to support legal research and productivity. Outputs may contain errors and should be independently verified.</p>
              <h4>1. Use of Service</h4>
              <ul>
                <li>You must use SwitchAi lawfully and responsibly. Do not upload unlawful or harmful content.</li>
                <li>You are responsible for how you use the information and outputs generated by the app.</li>
              </ul>
              <h4>2. Privacy & Data</h4>
              <ul>
                <li>Sign-in uses Google OAuth. Basic account identifiers are used to authenticate you.</li>
                <li>We minimize data collection and use it to provide and improve the service. Do not paste sensitive or confidential data that you are not authorized to share.</li>
              </ul>
              <h4>3. Acceptable Use</h4>
              <p>Do not attempt to reverse engineer, abuse, or overload the service. Do not use it for unlawful activities or to generate harmful content.</p>
              <h4>4. Third-Party Services</h4>
              <p>SwitchAi integrates third-party APIs (e.g., Google, AI model providers). Their terms and privacy policies apply.</p>
              <h4>5. Limitation of Liability</h4>
              <p>SwitchAi is provided “as is” without warranties. We are not liable for any damages arising from your use of the app or reliance on outputs.</p>
              <h4>6. Changes</h4>
              <p>We may update these terms from time to time. Continued use constitutes acceptance of the revised terms.</p>
              <h4>7. Contact</h4>
              <p>For questions about these terms, contact the SwitchAi team.</p>
            </div>
            <div className="modalFooter">
              <button className="acceptBtn" onClick={() => { setAcceptedTerms(true); setShowTerms(false); }}>Accept Terms & Conditions</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
