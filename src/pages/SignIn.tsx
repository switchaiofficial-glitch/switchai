import { auth, googleProvider } from '@/lib/firebase';
import { browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithPopup } from 'firebase/auth';
import Lottie from 'lottie-react';
import { Lock } from 'lucide-react';
import React from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function SignIn() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const rememberMe = true; // Always remember user (compulsory)
  const [showTerms, setShowTerms] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  const [welcomeAnim, setWelcomeAnim] = React.useState<any>(null);
  const [googleAnim, setGoogleAnim] = React.useState<any>(null);
  const [googleLoadingAnim, setGoogleLoadingAnim] = React.useState<any>(null);

  React.useEffect(() => {
    fetch('/animations/welcometext.json').then(r => r.json()).then(setWelcomeAnim).catch(() => { });
    fetch('/animations/google.json').then(r => r.json()).then(setGoogleAnim).catch(() => { });
    fetch('/animations/googleloading.json').then(r => r.json()).then(setGoogleLoadingAnim).catch(() => { });
  }, []);

  const handleBack = () => {
    setIsTransitioning(true);
    // Delay navigation to allow fade-out animation
    setTimeout(() => {
      navigate(-1);
    }, 300);
  };

  const handleGoogle = async () => {
    if (!acceptedTerms) {
      toast.error('Please accept the Terms and Conditions to continue.');
      return;
    }
    setIsLoading(true);
    try {
      // Set persistence based on Remember Me before signing in
      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch { }
      const cred = await signInWithPopup(auth, googleProvider);
      if (rememberMe) {
        try { localStorage.setItem('uid', cred.user.uid); } catch { }
      }
      navigate('/homescreen', { replace: true });
    } catch (e: any) {
      let msg = 'Google sign-in failed';
      if (typeof e?.message === 'string') msg += `: ${e.message}`;
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`signin-container ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
      {/* Background Elements */}
      <div className="signin-gradient" />
      <div className="signin-geo1" />
      <div className="signin-geo2" />
      <div className="signin-geo3" />

      {/* Navigation Bar */}
      <div className="signin-navbar">
        <button
          onClick={handleBack}
          className="signin-back-btn"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="signin-title">Sign in</h1>
        <div className="signin-navbar-spacer" />
      </div>

      {/* Main Content */}
      <div className="signin-main">
        {/* Content Card */}
        <div className="signin-content">
          {/* Welcome Animation */}
          <div className="signin-animation">
            {welcomeAnim && (
              <Lottie
                animationData={welcomeAnim}
                loop
                className="signin-welcome-lottie"
              />
            )}
          </div>

          {/* Form Section */}
          <div className="signin-form">
            <div className="signin-form-content">
              <p className="signin-subtitle">
                Continue with Google to get started
              </p>

              {/* Google Sign In Button */}
              <div className="signin-google-wrapper">
                <button
                  className="signin-google-btn"
                  onClick={handleGoogle}
                  disabled={isLoading}
                  aria-label="Continue with Google"
                >
                  <div className="signin-google-content">
                    <Lottie
                      animationData={isLoading ? googleLoadingAnim : googleAnim}
                      loop
                      className="signin-google-lottie"
                    />
                    {!isLoading && (
                      <span className="signin-google-text">
                        Continue with Google
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Terms Checkbox */}
              <div className="signin-terms-row">
                <label className="signin-checkbox-container">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="signin-checkbox-input"
                  />
                  <span className="signin-checkbox-custom">
                    {acceptedTerms && <span className="signin-checkbox-check">✓</span>}
                  </span>
                </label>
                <span className="signin-terms-text">
                  I accept the{' '}
                  <button
                    onClick={() => setShowTerms(true)}
                    className="signin-terms-link"
                  >
                    Terms & Conditions
                  </button>
                </span>
              </div>

              {/* Security Notice */}
              <div className="signin-security-notice">
                <Lock className="signin-security-icon" size={16} />
                <span className="signin-security-text">
                  Your data is protected with Google OAuth
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTerms && (
        <div className="signin-modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="signin-modal-header">
              <h3 className="signin-modal-title">Terms & Conditions</h3>
              <p className="signin-modal-subtitle">Please review before continuing</p>
            </div>
            <div className="signin-modal-body">
              <div className="signin-terms-content">
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
            </div>

            <div className="signin-modal-footer">
              <button
                className="signin-accept-btn"
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTerms(false);
                }}
              >
                Accept Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
