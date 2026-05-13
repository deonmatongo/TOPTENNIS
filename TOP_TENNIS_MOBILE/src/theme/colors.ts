// ─────────────────────────────────────────────────────────────────────────────
// TopTennis Design System v2
// ─────────────────────────────────────────────────────────────────────────────

export const Palette = {
  // Brand
  orange50:  '#FFF7ED',
  orange100: '#FFEDD5',
  orange200: '#FED7AA',
  orange400: '#FB923C',
  orange500: '#FF5500',   // primary
  orange600: '#E04400',
  orange700: '#C23800',

  // Neutrals
  white:     '#FFFFFF',
  gray50:    '#FAFAFA',
  gray100:   '#F4F4F8',
  gray150:   '#EDEDF3',
  gray200:   '#E2E2EC',
  gray300:   '#CBCBDB',
  gray400:   '#9A9AB0',
  gray500:   '#6E6E84',
  gray600:   '#4A4A60',
  gray700:   '#2E2E44',
  gray900:   '#0D0D18',

  // Dark surfaces
  dark900:   '#0D0D18',
  dark800:   '#141422',
  dark700:   '#1C1C2E',
  dark600:   '#24243A',

  // Semantic
  green400:  '#34D399',
  green500:  '#10B981',
  green600:  '#059669',
  greenBg:   '#ECFDF5',

  red400:    '#F87171',
  red500:    '#EF4444',
  red600:    '#DC2626',
  redBg:     '#FEF2F2',

  yellow400: '#FCD34D',
  yellow500: '#F59E0B',
  yellowBg:  '#FFFBEB',

  blue400:   '#60A5FA',
  blue500:   '#3B82F6',
  blue600:   '#2563EB',
  blueBg:    '#EFF6FF',

  purple500: '#8B5CF6',
  purpleBg:  '#F5F3FF',

  pink500:   '#EC4899',
  pinkBg:    '#FDF2F8',
};

// ─── Semantic tokens ──────────────────────────────────────────────────────────

export const Colors = {
  // Primary brand
  primary:       Palette.orange500,
  primaryDark:   Palette.orange600,
  primaryDeep:   Palette.orange700,
  primaryLight:  Palette.orange50,
  primaryMuted:  Palette.orange200,

  // Accent
  accent:        Palette.blue500,
  accentLight:   Palette.blueBg,
  accentDark:    Palette.blue600,

  secondary:     Palette.orange600,
  secondaryLight: Palette.orange100,

  // Backgrounds
  background:    Palette.gray100,
  backgroundAlt: Palette.gray150,
  surface:       Palette.white,
  surfaceWarm:   Palette.gray50,
  surfaceDark:   Palette.dark700,
  surfaceElevated: Palette.white,

  // Text
  text:          Palette.gray900,
  textSecondary: Palette.gray500,
  textMuted:     Palette.gray400,
  textInverse:   Palette.white,
  textOnDark:    'rgba(255,255,255,0.90)',
  textOnDarkMuted:'rgba(255,255,255,0.55)',

  // Borders
  border:        Palette.gray200,
  borderLight:   Palette.gray150,
  separator:     Palette.gray150,

  // Semantic
  success:       Palette.green500,
  successLight:  Palette.greenBg,
  warning:       Palette.yellow500,
  warningLight:  Palette.yellowBg,
  error:         Palette.red500,
  errorLight:    Palette.redBg,
  info:          Palette.blue500,
  infoLight:     Palette.blueBg,

  // Tab bar
  tabBar:        Palette.white,
  tabBarBorder:  Palette.gray150,
  tabBarActive:  Palette.orange500,
  tabBarInactive:Palette.gray400,

  // Gradients
  gradientPrimary:   [Palette.orange500, Palette.orange400] as [string, string],
  gradientWarm:      [Palette.orange700, Palette.orange500] as [string, string],
  gradientHero:      [Palette.dark900, Palette.dark700, Palette.dark600] as [string, string, string],
  gradientCard:      [Palette.dark800, Palette.dark700] as [string, string],
  gradientNature:    [Palette.green600, Palette.green400] as [string, string],
  gradientBlue:      [Palette.blue600, Palette.blue400] as [string, string],
  gradientPurple:    ['#6D28D9', Palette.purple500] as [string, string],
  gradientSubtle:    [Palette.white, Palette.gray50] as [string, string],

  overlay:       'rgba(13,13,24,0.55)',
  overlayLight:  'rgba(13,13,24,0.10)',
  shadow:        'rgba(13,13,24,0.06)',
  shadowMd:      'rgba(13,13,24,0.10)',
  shadowLg:      'rgba(13,13,24,0.18)',
  shadowOrange:  'rgba(255,85,0,0.30)',
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const Spacing = {
  xxs:   2,
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  xxl:   24,
  xxxl:  32,
  xxxxl: 48,
};

// ─── Radii ────────────────────────────────────────────────────────────────────

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  xxl:  32,
  full: 9999,
};

// ─── Typography ───────────────────────────────────────────────────────────────

export const FontSize = {
  xxs:     10,
  xs:      12,
  sm:      13,
  md:      15,
  lg:      17,
  xl:      20,
  xxl:     24,
  xxxl:    30,
  display: 38,
};

export const FontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
};

export const Font = {
  regular:   'Nunito_400Regular',
  medium:    'Nunito_500Medium',
  semibold:  'Nunito_600SemiBold',
  bold:      'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black:     'Nunito_900Black',
};

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const Shadow = {
  xs: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: Colors.shadowMd,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: Colors.shadowMd,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.shadowLg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  orange: {
    shadowColor: Colors.shadowOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
};
