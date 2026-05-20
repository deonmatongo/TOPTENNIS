const { withAndroidManifest } = require('@expo/config-plugins');

// Caps legacy storage permissions to Android 12L (API 32) — required by Google Play
// since Android 13 replaced them with READ_MEDIA_IMAGES etc.
module.exports = function withLegacyStoragePermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const usesPermissions = manifest['uses-permission'] ?? [];

    const legacyPerms = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ];

    legacyPerms.forEach((name) => {
      const existing = usesPermissions.find((p) => p.$?.['android:name'] === name);
      if (existing) {
        existing.$['android:maxSdkVersion'] = '32';
      } else {
        usesPermissions.push({ $: { 'android:name': name, 'android:maxSdkVersion': '32' } });
      }
    });

    manifest['uses-permission'] = usesPermissions;
    return config;
  });
};
