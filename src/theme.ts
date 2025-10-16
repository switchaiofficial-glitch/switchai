export type WebTheme = {
  mode: 'dark' | 'light';
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    textSecondary: string;
    border: string;
    borderLight: string;
    primary: string;
    primaryMuted: string;
    accentBlue: string;
    success: string;
    error: string;
  };
  gradients: {
    background: readonly [string, string, ...string[]];
    messageUser: readonly [string, string, ...string[]];
    messageAssistant: readonly [string, string, ...string[]];
    accent: readonly [string, string, ...string[]];
  };
  radii: { md: number; lg: number; pill: number };
};

export const darkTheme: WebTheme = {
  mode: 'dark',
  colors: {
    background: '#000000',
    surface: 'rgba(10, 10, 10, 0.8)',
    surfaceAlt: 'rgba(15, 15, 15, 0.95)',
    text: '#ffffff',
    textMuted: '#e5e7eb',
    textSecondary: '#94a3b8',
    border: 'rgba(255,255,255,0.1)',
    borderLight: 'rgba(255,255,255,0.15)',
    primary: '#10b981',
    primaryMuted: 'rgba(16,185,129,0.25)',
    accentBlue: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
  },
  gradients: {
    background: ['#000000', '#000000', '#0a0a0a'] as const,
    messageUser: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.05)'] as const,
    messageAssistant: ['transparent', 'transparent'] as const,
    accent: ['#10b981', '#3b82f6'] as const,
  },
  radii: { md: 12, lg: 16, pill: 999 },
};

export const theme = darkTheme;
