import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

const SLIDES = [
  {
    id: '1',
    bg: [Palette.dark900, Palette.dark700] as [string, string],
    icon: 'tennisball' as const,
    iconBg: Colors.primary,
    iconColor: '#fff' as string,
    eyebrow: 'WELCOME TO',
    title: 'TopTennis',
    sub: 'Your tennis community awaits. Find players, schedule matches, and elevate your game — all in one place.',
  },
  {
    id: '2',
    bg: [Palette.orange700, Palette.orange500] as [string, string],
    icon: 'people' as const,
    iconBg: 'rgba(255,255,255,0.18)' as string,
    iconColor: '#fff' as string,
    eyebrow: 'CONNECT WITH',
    title: 'Players Near You',
    sub: 'Discover tennis players at your skill level nearby. Casual hits or competitive matches — your choice.',
  },
  {
    id: '3',
    bg: ['#1a1a2e', '#0f3460'] as [string, string],
    icon: 'trophy' as const,
    iconBg: 'rgba(252,211,77,0.14)' as string,
    iconColor: Palette.yellow400,
    eyebrow: 'COMPETE &',
    title: 'Grow Your Game',
    sub: 'Join leagues, track your performance, and climb the rankings in your local tennis community.',
  },
] as const;

interface Props {
  onDone: () => void;
}

export const AppIntroScreen: React.FC<Props> = ({ onDone }) => {
  const { width: W } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = index === SLIDES.length - 1;

  const goNext = () => {
    if (!isLast) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={SLIDES as any}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        onMomentumScrollEnd={e => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / W));
        }}
        renderItem={({ item: s }) => (
          <LinearGradient colors={s.bg} style={[styles.slide, { width: W }]}>
            <SafeAreaView style={styles.slideInner} edges={['top']}>
              {/* Center content on wide screens */}
              <View style={styles.slideContent}>
              {/* Logo */}
              <View style={styles.logoRow}>
                <View style={[styles.logoBox, { backgroundColor: s.id === '1' ? Colors.primary : 'rgba(255,255,255,0.18)' }]}>
                  <Text style={styles.logoLetter}>T</Text>
                </View>
                <Text style={styles.logoName}>opTennis</Text>
              </View>

              {/* Icon medallion */}
              <View style={[styles.iconWrap, { backgroundColor: s.iconBg }]}>
                <Ionicons name={s.icon} size={76} color={s.iconColor} />
              </View>

              {/* Copy */}
              <Text style={styles.eyebrow}>{s.eyebrow}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.sub}>{s.sub}</Text>
              </View>
            </SafeAreaView>
          </LinearGradient>
        )}
      />

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          {/* Dot indicators */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={isLast ? onDone : goNext}
            activeOpacity={0.87}
          >
            <LinearGradient
              colors={[Palette.orange500, Palette.orange700]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaText}>
                {isLast ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons
                name={isLast ? 'arrow-forward' : 'chevron-forward'}
                size={18}
                color="#fff"
              />
            </LinearGradient>
          </TouchableOpacity>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.dark900 },

  slide: { flex: 1 },
  slideInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: 160,
    alignItems: 'center',
    gap: Spacing.lg,
  },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xxl },
  logoBox: {
    width: 40, height: 40, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.black },
  logoName: { color: '#fff', fontSize: 28, fontWeight: FontWeight.black, letterSpacing: -0.5 },

  iconWrap: {
    width: 148, height: 148, borderRadius: 74,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: Spacing.xl,
  },

  eyebrow: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.bold,
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: FontSize.display,
    fontWeight: FontWeight.black,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  sub: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: FontSize.md,
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
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },

  ctaBtn: { borderRadius: Radius.full, overflow: 'hidden', marginBottom: Spacing.md },
  ctaGrad: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ctaText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

  signinRow: { alignItems: 'center', paddingVertical: Spacing.md, paddingBottom: Spacing.sm },
  signinText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  signinLink: { color: Colors.primary, fontWeight: FontWeight.bold },
});
