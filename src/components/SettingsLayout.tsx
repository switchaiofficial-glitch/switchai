import { ChevronLeft } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/animations.css';

interface SettingsLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function SettingsLayout({ title, subtitle, children }: SettingsLayoutProps) {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      background: '#000000',
      color: '#ffffff',
      overflow: 'hidden',
    }}>
      {/* Geometric decorative elements */}
      <div style={{
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        top: '-15%',
        right: '-15%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 180,
        height: 180,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transform: 'rotate(45deg)',
        bottom: '20%',
        left: '10%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        border: '1px solid rgba(255, 255, 255, 0.04)',
        top: '60%',
        right: '10%',
        pointerEvents: 'none',
      }} />

      {/* Header with gradient overlay */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'transparent',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 16px 12px',
          position: 'relative',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute',
              left: 16,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              color: '#e5e7eb',
              fontSize: 20,
              fontWeight: 800,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              letterSpacing: '0.3px',
              margin: 0,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{
                fontSize: 13,
                color: '#94a3b8',
                margin: '2px 0 0 0',
                fontWeight: 500,
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Header fade overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7), transparent)',
          pointerEvents: 'none',
          zIndex: -1,
        }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        padding: '24px 16px 120px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div className="animate-fade-in-up" style={{
          maxWidth: 900,
          margin: '0 auto',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
