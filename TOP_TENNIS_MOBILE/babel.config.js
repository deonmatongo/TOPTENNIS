module.exports = function(api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProduction ? [['transform-remove-console', { exclude: [] }]] : []),
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
          },
        },
      ],
      // Reanimated 4 moved the worklets compiler into react-native-worklets
      'react-native-worklets/plugin',
    ],
  };
};
