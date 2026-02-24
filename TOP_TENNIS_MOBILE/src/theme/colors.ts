// Matches web version: hsl(25 95% 53%) = #F97316 orange primary
export const Colors = {
  // Primary — Tennis Orange (web: --primary: 25 95% 53%)
  primary: '#F97316',
  primaryDark: '#EA6C0A',
  primaryLight: '#FFF7ED',
  primaryMuted: '#FED7AA',

  // Accent — Blue (web: --accent: 217 91% 60%)
  accent: '#3B82F6',
  accentLight: '#EFF6FF',
  accentDark: '#2563EB',

  // Secondary — warm orange-600 (web gradient warm)
  secondary: '#EA580C',
  secondaryLight: '#FEF3C7',

  // Backgrounds (web: --background: 0 0% 100%, --tennis-gray-50)
  background: '#F8FAFC',
  backgroundAlt: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Text (web: --foreground: 222.2 84% 4.9% = #0A0F1E, --tennis-gray-*)
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders (web: --border: 214.3 31.8% 91.4% = #E2E8F0)
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Semantic
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Tab bar
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#F97316',
  tabBarInactive: '#94A3B8',

  // Gradients (web: --gradient-primary: orange→orange-light)
  gradientPrimary: ['#F97316', '#FB923C'] as [string, string],
  gradientWarm: ['#F97316', '#EA580C'] as [string, string],
  gradientNature: ['#16A34A', '#22C55E'] as [string, string],
  gradientBlue: ['#3B82F6', '#60A5FA'] as [string, string],

  overlay: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(0,0,0,0.08)',
  shadowOrange: 'rgba(249,115,22,0.25)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Web uses --radius: 1rem = 16px
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
