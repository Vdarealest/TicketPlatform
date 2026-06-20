// Vietix Design System - Design Tokens

export const COLORS = {
  // Primary
  primary: '#0F35FF',
  deepNavy: '#171717',

  // Accent Colors
  electricBlue: '#007AFF',
  skyBlue: '#5AC8FA',
  turquoise: '#34AADC',
  cerulean: '#3498DB',

  // Interactive
  darkButton: '#000000',
  ghostText: '#24292E',
  lightButtonBg: '#F6F7F9',

  // Neutral Scale
  charcoalText: '#24292E',
  darkGray: '#454C52',
  mediumGray: '#9EA5AD',
  lightGray: '#E5E7EA',
  offWhite: '#FFFFFF',
  nearBlack: '#121212',

  // Semantic / Status
  successGreen: '#07BC0C',
  warningYellow: '#F1C40F',
  successTeal: '#4CD964',
  errorRed: '#CD3636',
  errorOrange: '#E74D3C',

  // Background / Surfaces
  whiteSurface: '#FFFFFF',
  lightSurface: '#F6F7F9',
  blueTintSurface: '#E8F4FF',
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    primary:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fallback:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
    mono: 'Courier New, monospace',
  },

  sizes: {
    h1: { size: '48px', weight: 700, lineHeight: '60px' },
    h2: { size: '48px', weight: 700, lineHeight: '60px' },
    h3: { size: '32px', weight: 700, lineHeight: '40px' },
    h4: { size: '14px', weight: 600, lineHeight: '21px' },
    bodyLarge: { size: '16px', weight: 400, lineHeight: '24px' },
    bodyRegular: { size: '14px', weight: 400, lineHeight: '20px' },
    bodySmall: { size: '14px', weight: 400, lineHeight: '20px' },
    input: { size: '16px', weight: 500, lineHeight: '24px' },
    button: { size: '14px', weight: 400, lineHeight: '20px' },
    caption: { size: '12px', weight: 400, lineHeight: '16px' },
  } as const,
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '28px',
  xxxl: '32px',
  hero: '40px',
  giant: '56px',
  jumbo: '60px',
} as const;

export const BORDER_RADIUS = {
  none: '0px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const;

export const SHADOWS = {
  none: 'none',
  subtle: 'rgba(0, 0, 0, 0.04) 0px 4px 16px 0px',
  raised:
    'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px',
  modal: 'rgba(0, 0, 0, 0.04) 0px 4px 16px 0px',
  inset: 'rgba(255, 255, 255, 0.08) 0px 0px 12px 0px inset',
} as const;

export const BREAKPOINTS = {
  mobile: '0px',
  tablet: '768px',
  desktop: '1200px',
} as const;

export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 500,
  fixed: 1000,
  modal: 1500,
  popover: 1600,
  tooltip: 1700,
} as const;
