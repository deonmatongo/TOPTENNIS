import React from 'react';
import { Text, StyleSheet, ViewStyle, Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontWeight } from '@/theme/colors';

interface AvatarProps {
  name: string;
  size?: number;
  style?: ViewStyle;
  imageUrl?: string | null;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 44, style, imageUrl }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (imageUrl) {
    return (
      <View style={[styles.imageContainer, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={Colors.gradientWarm}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    overflow: 'hidden',
  },
  text: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },
});
