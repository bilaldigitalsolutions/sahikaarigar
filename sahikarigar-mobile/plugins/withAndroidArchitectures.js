// =============================================================================
// Expo config plugin — trims the release APK down to the architectures we
// actually ship.
// =============================================================================
// By default a React Native release APK bundles native libraries for four
// ABIs (armeabi-v7a, arm64-v8a, x86, x86_64). The x86/x86_64 builds are only
// useful for emulators, and almost every phone made since ~2017 is arm64 — so
// keeping just arm64-v8a cuts the download dramatically (the Mappls/Mapbox SDK
// alone is tens of MB per ABI).
//
// Override when needed:
//   EXPO_ANDROID_ARCHS="arm64-v8a,armeabi-v7a" npx eas build -p android
// =============================================================================

const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'reactNativeArchitectures';
const DEFAULT_ARCHS = 'arm64-v8a';

module.exports = (config) =>
  withGradleProperties(config, (cfg) => {
    const archs = process.env.EXPO_ANDROID_ARCHS || DEFAULT_ARCHS;
    const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === KEY);

    if (existing) {
      existing.value = archs;
    } else {
      cfg.modResults.push({ type: 'property', key: KEY, value: archs });
    }

    return cfg;
  });
