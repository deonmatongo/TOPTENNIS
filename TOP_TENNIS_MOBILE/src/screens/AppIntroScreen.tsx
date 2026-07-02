import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { Colors, Palette, Font, FontSize, Spacing, Radius } from '@/theme/colors';

// ─────────────────────────────────────────────────────────────────────────────
// Slides — night match → grass court → clay court
// ─────────────────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: '1',
    bg: Colors.gradientNightMatch,
    eyebrow: 'WELCOME TO THE CLUB',
    title: 'Top Tennis',
    sub: 'Find players, book matches, and own your local courts — your whole tennis life in one app.',
    hero: 'ball' as const,
  },
  {
    id: '2',
    bg: Colors.gradientCourt,
    eyebrow: 'RALLY UP',
    title: 'Find Your\nHitting Partner',
    sub: 'Match with players at your level, nearby and ready to play. Casual rallies or full-on battles — you choose.',
    hero: 'people' as const,
  },
  {
    id: '3',
    bg: Colors.gradientWarm,
    eyebrow: 'GAME · SET · MATCH',
    title: 'Climb The\nLadder',
    sub: 'Join leagues, log every win, and fight your way up the local leaderboard.',
    hero: 'trophy' as const,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Decorative court lines (baseline + centre service line + service boxes)
// ─────────────────────────────────────────────────────────────────────────────

const CourtLines: React.FC = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {/* singles sidelines */}
    <View style={[court.line, { left: 24, top: 0, bottom: 0, width: 2 }]} />
    <View style={[court.line, { right: 24, top: 0, bottom: 0, width: 2 }]} />
    {/* baseline */}
    <View style={[court.line, { left: 24, right: 24, bottom: 120, height: 2 }]} />
    {/* service line */}
    <View style={[court.line, { left: 24, right: 24, top: '30%', height: 2 }]} />
    {/* centre service line */}
    <View style={[court.line, { left: '50%', top: '30%', bottom: 120, width: 2, marginLeft: -1 }]} />
  </View>
);

const court = StyleSheet.create({
  line: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.07)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hero: bouncing tennis ball with squash-and-stretch + shadow
// ─────────────────────────────────────────────────────────────────────────────

const BOUNCE_HEIGHT = 90;

const BouncingBall: React.FC = () => {
  // 0 = apex, 1 = ground contact
  const t = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    );
    spin.value = withRepeat(withTiming(360, { duration: 4200, easing: Easing.linear }), -1);
  }, []);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: t.value * BOUNCE_HEIGHT },
      // stretch mid-air, squash on contact
      { scaleY: interpolate(t.value, [0, 0.55, 0.92, 1], [1, 1.06, 1, 0.76]) },
      { scaleX: interpolate(t.value, [0, 0.55, 0.92, 1], [1, 0.96, 1, 1.22]) },
      { rotate: `${spin.value}deg` },
    ] as any,
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.12, 0.38]),
    transform: [{ scaleX: interpolate(t.value, [0, 1], [0.5, 1]) }],
  }));

  return (
    <View style={ball.stage}>
      <Animated.View style={[ball.shadow, shadowStyle]} />
      <Animated.View style={[ball.ball, ballStyle]}>
        {/* felt seam */}
        <View style={ball.seamTop} />
        <View style={ball.seamBottom} />
      </Animated.View>
    </View>
  );
};

const ball = StyleSheet.create({
  stage: { height: BOUNCE_HEIGHT + 130, alignItems: 'center', justifyContent: 'flex-start', marginVertical: Spacing.md },
  ball: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Palette.orange500,
    overflow: 'hidden',
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
  },
  seamTop: {
    position: 'absolute',
    top: -62,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  seamBottom: {
    position: 'absolute',
    bottom: -62,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  shadow: {
    position: 'absolute',
    top: BOUNCE_HEIGHT + 112,
    width: 96,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hero: medallion with pulsing "radar" rings (find players nearby)
// ─────────────────────────────────────────────────────────────────────────────

const PulseRings: React.FC<{ icon: keyof typeof Ionicons.glyphMap }> = ({ icon }) => {
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);

  useEffect(() => {
    p1.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1);
    p2.value = withDelay(1100, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1));
  }, []);

  const ring = (v: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: interpolate(v.value, [0, 0.7, 1], [0.5, 0.15, 0]),
      transform: [{ scale: interpolate(v.value, [0, 1], [1, 1.9]) }] as any,
    }));

  const r1 = ring(p1);
  const r2 = ring(p2);

  return (
    <View style={rings.stage}>
      <Animated.View style={[rings.ring, r1]} />
      <Animated.View style={[rings.ring, r2]} />
      <View style={rings.medallion}>
        <Ionicons name={icon} size={64} color="#fff" />
      </View>
    </View>
  );
};

const rings = StyleSheet.create({
  stage: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.md },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: Palette.orange400,
  },
  medallion: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Palette.orange500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 10,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hero: trophy with spring pop + orbiting sparkles
// ─────────────────────────────────────────────────────────────────────────────

const TrophyPop: React.FC = () => {
  const pop = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    pop.value = withRepeat(
      withSequence(
        withSpring(1, { damping: 6, stiffness: 120 }),
        withDelay(1600, withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) })),
      ),
      -1,
    );
    shine.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);

  const cupStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pop.value, [0, 1], [0.92, 1.04]) },
      { rotate: `${interpolate(pop.value, [0, 1], [-3, 3])}deg` },
    ] as any,
  }));

  const sparkle = (dx: number, dy: number, delayPct: number) =>
    useAnimatedStyle(() => {
      const v = (shine.value + delayPct) % 1;
      return {
        opacity: interpolate(v, [0, 0.5, 1], [0, 1, 0]),
        transform: [{ translateX: dx }, { translateY: dy }, { scale: interpolate(v, [0, 0.5, 1], [0.4, 1, 0.4]) }] as any,
      };
    });

  const s1 = sparkle(-78, -50, 0);
  const s2 = sparkle(84, -20, 0.33);
  const s3 = sparkle(-58, 56, 0.66);

  return (
    <View style={trophy.stage}>
      {[s1, s2, s3].map((s, i) => (
        <Animated.View key={i} style={[trophy.sparkle, s]}>
          <Ionicons name="sparkles" size={i === 1 ? 26 : 18} color="rgba(255,255,255,0.92)" />
        </Animated.View>
      ))}
      <Animated.View style={[trophy.medallion, cupStyle]}>
        <Ionicons name="trophy" size={70} color="#fff" />
      </Animated.View>
    </View>
  );
};

const trophy = StyleSheet.create({
  stage: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.md },
  sparkle: { position: 'absolute' },
  medallion: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export const AppIntroScreen: React.FC<Props> = ({ onDone }) => {
  const { width: W } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<Animated.FlatList<any>>(null);
  const scrollX = useSharedValue(0);
  const ctaScale = useSharedValue(1);
  const isLast = index === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x;
  });

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!isLast) {
      (listRef.current as any)?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone();
    }
  };

  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef as any}
        data={SLIDES as any}
        keyExtractor={(s: any) => s.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        onMomentumScrollEnd={e => {
          const next = Math.round(e.nativeEvent.contentOffset.x / W);
          if (next !== index) Haptics.selectionAsync().catch(() => {});
          setIndex(next);
        }}
        renderItem={({ item, index: i }) => (
          <Slide slide={item} index={i} width={W} scrollX={scrollX} />
        )}
      />

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          {/* Animated pagination */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <Dot key={i} i={i} width={W} scrollX={scrollX} />
            ))}
          </View>

          {/* Optic-yellow CTA — the tennis ball button */}
          <Animated.View style={ctaStyle}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={goNext}
              onPressIn={() => { ctaScale.value = withSpring(0.96, { damping: 20, stiffness: 400 }); }}
              onPressOut={() => { ctaScale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
              activeOpacity={0.9}
            >
              <Ionicons name="tennisball" size={18} color="#fff" />
              <Text style={styles.ctaText}>{isLast ? "Let's Play" : 'Next'}</Text>
              <Ionicons name={isLast ? 'arrow-forward' : 'chevron-forward'} size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>

          {/* Sign in link */}
          <TouchableOpacity style={styles.signinRow} onPress={onDone} activeOpacity={0.7}>
            <Text style={styles.signinText}>
              {'Already have an account? '}
              <Text style={styles.signinLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
};

// ─── Slide with scroll parallax ───────────────────────────────────────────────

const Slide: React.FC<{
  slide: (typeof SLIDES)[number];
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}> = ({ slide: s, index: i, width: W, scrollX }) => {
  const range = [(i - 1) * W, i * W, (i + 1) * W];

  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.35, 0, -W * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollX.value, range, [0.7, 1, 0.7], Extrapolation.CLAMP) },
    ] as any,
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.18, 0, -W * 0.18], Extrapolation.CLAMP) },
    ] as any,
  }));

  return (
    <LinearGradient colors={s.bg as any} style={[styles.slide, { width: W }]}>
      <CourtLines />
      <SafeAreaView style={styles.slideInner} edges={['top']}>
        <View style={styles.slideContent}>
          {/* Brand lockup */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Ionicons name="tennisball" size={20} color="#fff" />
            </View>
            <Text style={styles.logoName}>TopTennis</Text>
          </Animated.View>

          {/* Hero animation */}
          <Animated.View style={heroStyle}>
            {s.hero === 'ball' && <BouncingBall />}
            {s.hero === 'people' && <PulseRings icon="people" />}
            {s.hero === 'trophy' && <TrophyPop />}
          </Animated.View>

          {/* Copy */}
          <Animated.View style={[styles.copyBlock, copyStyle]}>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrow}>{s.eyebrow}</Text>
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.sub}>{s.sub}</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ─── Animated pagination dot ──────────────────────────────────────────────────

const Dot: React.FC<{ i: number; width: number; scrollX: SharedValue<number> }> = ({ i, width: W, scrollX }) => {
  const range = [(i - 1) * W, i * W, (i + 1) * W];
  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [8, 30, 8], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(scrollX.value, range, [
      Colors.borderLight,
      Palette.orange500,
      Colors.borderLight,
    ]),
  }));
  return <Animated.View style={[styles.dot, style]} />;
};

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.dark900 },

  slide: { flex: 1 },
  slideInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slideContent: {
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: 170,
    alignItems: 'center',
  },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  logoBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Palette.orange500,
    alignItems: 'center', justifyContent: 'center',
  },
  logoName: { color: '#fff', fontSize: 24, fontFamily: Font.black, letterSpacing: -0.5 },

  copyBlock: { alignItems: 'center', gap: Spacing.md },
  eyebrowChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  eyebrow: {
    color: Palette.orange100,
    fontSize: FontSize.xxs,
    fontFamily: Font.extrabold,
    letterSpacing: 3,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontFamily: Font.black,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 46,
  },
  sub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: FontSize.md,
    fontFamily: Font.medium,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 24,
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  dot: { height: 8, borderRadius: 4 },

  ctaBtn: {
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Palette.orange500,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: { color: '#fff', fontSize: FontSize.lg, fontFamily: Font.extrabold },

  signinRow: { alignItems: 'center', paddingVertical: Spacing.md, paddingBottom: Spacing.sm },
  signinText: { fontSize: FontSize.sm, fontFamily: Font.medium, color: Colors.textSecondary },
  signinLink: { color: Palette.orange500, fontFamily: Font.extrabold },
});
