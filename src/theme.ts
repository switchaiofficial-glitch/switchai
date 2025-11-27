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
    background: '#212121',  // Main page: rgb(33, 33, 33)
    surface: '#181818',     // Sidebar: rgb(24, 24, 24)
    surfaceAlt: '#2a2a2a',  // Input/message area (slightly lighter)
    text: '#ececec',        // Light text
    textMuted: '#b4b4b4',
    textSecondary: '#8e8e8e',
    border: '#444444',      // Subtle border
    borderLight: '#555555',
    primary: '#19c37d',     // ChatGPT's green
    primaryMuted: 'rgba(25,195,125,0.25)',
    accentBlue: '#3b82f6',
    success: '#19c37d',
    error: '#ef4444',
  },
  gradients: {
    background: ['#212121', '#212121', '#212121'] as const,
    messageUser: ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.02)'] as const,
    messageAssistant: ['transparent', 'transparent'] as const,
    accent: ['#19c37d', '#3b82f6'] as const,
  },
  radii: { md: 12, lg: 16, pill: 999 },
};

export const theme = darkTheme;
