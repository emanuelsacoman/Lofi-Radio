export interface SiteThemeColors {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  accentLight: string;
  text: string;
}

export interface SiteTheme {
  id: string;
  name: string;
  colors: SiteThemeColors;
  createdAt?: string;
  order?: number;
  swatch?: string;
}

export const FALLBACK_SITE_THEME: SiteTheme = {
  id: 'purple',
  name: 'Roxo',
  order: 1,
  swatch: '#9c27b0',
  colors: {
    background: '#1f1e30',
    primary: '#aea4d3',
    secondary: '#4b3470',
    accent: '#805cb1',
    accentLight: '#707cb5',
    text: '#eff1e4'
  }
};

export function siteThemeToCssVariables(colors: SiteThemeColors): Record<string, string> {
  return {
    '--clr-background': colors.background,
    '--clr-primary': colors.primary,
    '--clr-secondary': colors.secondary,
    '--clr-accent': colors.accent,
    '--clr-accent-light': colors.accentLight,
    '--clr-text': colors.text
  };
}
