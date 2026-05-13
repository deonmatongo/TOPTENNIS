import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Call } from '@/hooks/useCall';
import { Palette, Colors, Font, Spacing, Radius } from '@/theme/colors';

interface Props {
  call: Call;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallOverlay: React.FC<Props> = ({ call, onAnswer, onDecline }) => {
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    // Slide in from top
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();

    // Pulse animation on avatar
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const isVideo = call.call_type === 'video';
  const callerName = call.caller_name ?? 'Unknown';
  const subtitle = isVideo ? 'Incoming Video Call' : 'Incoming Voice Call';

  return (
    <Animated.View style={[s.container, { paddingTop: insets.top + 12, transform: [{ translateY: slideY }] }]}>
      <View style={s.inner}>
        {/* Avatar */}
        <Animated.View style={[s.avatarWrap, { transform: [{ scale: pulse }] }]}>
          <View style={s.avatar}>
            <Ionicons name="person" size={32} color="rgba(255,255,255,0.7)" />
          </View>
          <View style={s.avatarRing} />
        </Animated.View>

        {/* Info */}
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{callerName}</Text>
          <View style={s.subtitleRow}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={12} color="rgba(255,255,255,0.55)" />
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, s.declineBtn]} onPress={onDecline} activeOpacity={0.85}>
            <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.answerBtn]} onPress={onAnswer} activeOpacity={0.85}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Palette.dark800,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  inner:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatarRing: { position: 'absolute', inset: -4, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  info:       { flex: 1 },
  name:       { fontSize: 16, fontFamily: Font.bold, color: '#fff' },
  subtitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subtitle:   { fontSize: 12, fontFamily: Font.regular, color: 'rgba(255,255,255,0.55)' },
  actions:    { flexDirection: 'row', gap: Spacing.sm },
  actionBtn:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { backgroundColor: Colors.error },
  answerBtn:  { backgroundColor: Colors.success },
});
