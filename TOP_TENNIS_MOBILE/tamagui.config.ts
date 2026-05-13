import { createTamagui } from 'tamagui'
import { defaultConfig } from '@tamagui/config/v4'
import { createAnimations } from '@tamagui/animations-react-native'

const animations = createAnimations({
  fast: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  slow: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  bouncy: {
    type: 'spring',
    damping: 8,
    mass: 1,
    stiffness: 120,
  },
  quick: {
    type: 'timing',
    duration: 150,
  },
})

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations,
})

export default tamaguiConfig
export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
