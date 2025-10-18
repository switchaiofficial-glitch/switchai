import React from 'react';
import '../styles/animations.css';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div 
      className="animate-fade-in" 
      style={{
        animation: 'fadeIn 0.3s ease-out forwards',
      }}
    >
      {children}
    </div>
  );
}
