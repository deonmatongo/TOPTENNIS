import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FontSize, FontWeight, Spacing } from '@/theme/colors';

export const NetworkBanner: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOnline) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (wasOffline) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start();
        }, 2000);
      });
    } else {
      translateY.setValue(-60);
      opacity.setValue(0);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !wasOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline ? styles.bannerOnline : styles.bannerOffline,
        { transform: [{ translateY }], opacity, paddingTop: insets.top + Spacing.sm },
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={isOnline ? 'wifi-outline' : 'cloud-offline-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {isOnline ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  bannerOffline: { backgroundColor: '#374151' },
  bannerOnline: { backgroundColor: '#16a34a' },
  text: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
