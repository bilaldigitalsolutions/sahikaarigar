// =============================================================================
// SahiKaarigar — design tokens
// =============================================================================
// Mirrors the web app's Tailwind theme (sahikarigar-app/tailwind.config.js) so
// the native app and the website look like the same product.
// =============================================================================

export const colors = {
  // Brand (WCAG compliant green theme)
  primary: '#16A34A', // decorative (icons, badges)
  primaryDark: '#15803D', // buttons, CTAs, text on white
  primaryLight: '#22C55E', // backgrounds, badges, gradients
  primaryBg: '#DCFCE7', // soft green fill (chips, icon tiles)
  primaryTint: '#E9F9EF', // very light green section background
  primaryBorder: '#BBF7D0', // green hairline
  star: '#F5B301', // rating gold
  brandOrange: '#F97316', // logo ring

  // Neutrals
  background: '#FAFAFA',
  card: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  border: '#E5E7EB',
  muted: '#9CA3AF',

  // Status
  success: '#28A745',
  warning: '#FFC107',
  danger: '#DC3545',

  // Absolute
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.4)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  button: 12,
  card: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 14,
  small: 16,
  body: 18,
  title: 20,
  h2: 24,
  h1: 30,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** React Native shadow presets (iOS shadow* + Android elevation). */
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  button: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

export const theme = { colors, spacing, radius, fontSize, fontWeight, shadows } as const;

export type Theme = typeof theme;
