export type WebTheme = {
  mode: 'dark' | 'light';
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    primaryMuted: string;
    accentBlue: string;
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
    surface: 'rgba(12,12,12,0.82)',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.75)',
    border: 'rgba(255,255,255,0.08)',
    primary: '#4F46E5',
    primaryMuted: 'rgba(79,70,229,0.25)',
    accentBlue: '#3B82F6',
  },
  gradients: {
    background: ['#000000', '#050505', '#0A0A0A'] as const,
    messageUser: ['rgba(0,0,0,0.60)', 'rgba(0,0,0,0.30)'] as const,
    messageAssistant: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.25)'] as const,
    accent: ['#6366F1', '#8B5CF6'] as const,
  },
  radii: { md: 12, lg: 16, pill: 999 },
};

export const theme = darkTheme;
