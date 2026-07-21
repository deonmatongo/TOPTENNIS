import React, { useState, useEffect } from 'react'
import { Text, Image, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, FontWeight } from '@/theme/colors'

interface AvatarProps {
  name:      string
  size?:     number
  style?:    object
  imageUrl?: string | null
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 44, style, imageUrl }) => {
  const [imgError, setImgError] = useState(false)

  // Reset error state whenever the URL changes (e.g. after a new upload)
  useEffect(() => { setImgError(false) }, [imageUrl])

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (imageUrl && !imgError) {
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
          style as any,
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      </View>
    )
  }

  return (
    <LinearGradient
      colors={Colors.gradientWarm}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style as any,
      ]}
    >
      <Text style={{ color: '#fff', fontWeight: FontWeight.bold, fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </LinearGradient>
  )
}
