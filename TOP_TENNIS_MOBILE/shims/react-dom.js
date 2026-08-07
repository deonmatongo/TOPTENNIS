// Shim for react-dom in React Native — for packages that import it in RN
// builds. Originally added for @tamagui/popper; kept because removing the
// metro alias would need an audit of every remaining dependency.
'use strict'

const ReactNative = require('react-native')

module.exports = {
  flushSync: (fn) => fn(),
  unstable_batchedUpdates: ReactNative.unstable_batchedUpdates || ((fn) => fn()),
}
