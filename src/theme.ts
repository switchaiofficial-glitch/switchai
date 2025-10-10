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
    background: 'rgba(11, 15, 20, 0.95)',
    surface: 'rgba(11, 15, 20, 0.7)',
    surfaceAlt: 'rgba(26, 28, 34, 0.98)',
    text: '#ffffff',
    textMuted: '#e5e7eb',
    textSecondary: '#94a3b8',
    border: 'rgba(255,255,255,0.08)',
    borderLight: 'rgba(255,255,255,0.12)',
    primary: '#10b981',
    primaryMuted: 'rgba(16,185,129,0.25)',
    accentBlue: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
  },
  gradients: {
    background: ['#0b0f14', '#0b0f14', '#111827'] as const,
    messageUser: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.08)'] as const,
    messageAssistant: ['transparent', 'transparent'] as const,
    accent: ['#10b981', '#3b82f6'] as const,
  },
  radii: { md: 12, lg: 16, pill: 999 },
};

export const theme = darkTheme;
