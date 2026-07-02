module.exports = function(api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProduction ? [['transform-remove-console', { exclude: [] }]] : []),
      // The Tamagui compiler is a build-time optimization; it evaluates the
      // full config, which crashes Jest workers, so it stays out of tests.
      ...(isTest
        ? []
        : [
            [
              '@tamagui/babel-plugin',
              {
                components: ['tamagui'],
                config: './tamagui.config.ts',
                logTimings: false,
                disableExtraction: process.env.NODE_ENV === 'development',
              },
            ],
          ]),
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
