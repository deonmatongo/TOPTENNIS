import { useWindowDimensions } from 'react-native';

export const TABLET_BREAKPOINT = 768;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isLandscape = width > height;
  // Sidebar is wide (with labels) in landscape, narrow (icons-only) in portrait
  const sidebarWidth = isTablet ? (isLandscape ? 220 : 72) : 0;
  return { width, height, isTablet, isLandscape, sidebarWidth };
}
