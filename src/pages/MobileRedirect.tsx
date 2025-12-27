import { ArrowRight, Smartphone } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function MobileRedirect({ onContinue }: { onContinue: () => void }) {
    const [countdown, setCountdown] = useState(5);
    const appPackage = 'com.vivekgowdas.SwitchAi';
    const playStoreUrl = `market://details?id=${appPackage}`;

    useEffect(() => {
        // Check if device is a phone (not tablet)
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent.toLowerCase());

            return isMobile && !isTablet;
        };

        if (checkMobile()) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.href = playStoreUrl;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [playStoreUrl]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: '#212121',
            color: '#ffffff',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
            textAlign: 'center'
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                background: '#ffffff',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2rem',
                color: '#212121'
            }}>
                <Smartphone size={40} />
            </div>

            <h1 style={{
                fontSize: '2rem',
                fontWeight: 400,
                marginBottom: '1rem',
                color: '#ffffff'
            }}>
                SwitchAi Mobile App
            </h1>

            <p style={{
                fontSize: '1.125rem',
                color: '#94a3b8',
                maxWidth: '320px',
                marginBottom: '2rem',
                lineHeight: 1.6
            }}>
                For the best experience, please use our mobile app. Redirecting you to the Play Store in {countdown}s...
            </p>

            <a
                href={playStoreUrl}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#ffffff',
                    color: '#000000',
                    padding: '16px 32px',
                    borderRadius: '999px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '1.125rem',
                    transition: 'transform 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                onClick={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                }}
            >
                <span>Open in Play Store</span>
                <ArrowRight size={20} />
            </a>

            <button
                onClick={onContinue}
                style={{
                    marginTop: '2rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                }}
            >
                Continue in browser (not recommended)
            </button>
        </div>
    );
}
