// Shim for react-dom in React Native — only flushSync is used by @tamagui/popper
'use strict'

const ReactNative = require('react-native')

module.exports = {
  flushSync: (fn) => fn(),
  unstable_batchedUpdates: ReactNative.unstable_batchedUpdates || ((fn) => fn()),
}
