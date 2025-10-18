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
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#000000',
      color: '#ffffff',
    }}>
      {/* Header with scroll shadow */}
      <div className="animate-fade-in-down" style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#000000',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        transition: 'box-shadow 0.3s ease',
        boxShadow: scrolled ? '0 4px 12px rgba(0, 0, 0, 0.5)' : 'none',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Back button with enhanced hover */}
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateX(-2px) scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
          >
            <ChevronLeft size={20} />
          </button>
          
          {/* Title with fade animation */}
          <div>
            <h1 style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              margin: 0, 
              color: '#ffffff',
              letterSpacing: '-0.3px',
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ 
                fontSize: 13, 
                color: '#666666', 
                margin: '2px 0 0 0',
                fontWeight: 500,
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content with fade-in animation */}
      <div className="animate-fade-in-up" style={{ 
        maxWidth: 900, 
        margin: '0 auto', 
        padding: '24px 20px 80px',
      }}>
        {children}
      </div>
    </div>
  );
}
